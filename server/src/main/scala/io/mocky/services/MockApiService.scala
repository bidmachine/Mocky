package io.mocky.services

import cats.effect.IO
import io.circe.syntax._
import io.circe.{ Decoder, Json }

import io.mocky.http.JsonMarshalling
import io.mocky.models.errors.MockNotFoundError
import io.mocky.models.mocks.actions.{ CreateUpdateMock, DeleteCapture, DeleteMock, ListCaptures, SetCapture }
import org.http4s._
import org.http4s.dsl.Http4sDsl
import org.http4s.server.middleware.CORS

import io.mocky.config.Settings
import io.mocky.models.mocks.MockCreatedResponse
import io.mocky.models.mocks.enums.Expiration
import io.mocky.repositories.MockV3Repository
import io.mocky.utils.HttpUtil

class MockApiService(repository: MockV3Repository, settings: Settings) extends Http4sDsl[IO] with JsonMarshalling {

  // Allow only request coming from `settings.cors.domain` and `settings.cors.devDomain` if env == dev
  private val corsAPIConfig = {
    val allowedDevDomains = if (settings.environment == "dev") settings.cors.devDomains else None
    val allowedDomains = Seq(settings.cors.domain) ++ allowedDevDomains.getOrElse(Nil)
    CORS.DefaultCORSConfig.copy(
      anyOrigin = false,
      allowedOrigins = origin => allowedDomains.contains(origin)
    )
  }

  // Expose the routes wrapped into their middleware
  lazy val routing: HttpRoutes[IO] = CORS(routes, corsAPIConfig)

  // Prepare a decoder with dynamic configuration
  implicit private val createUpdateMockDecoder: Decoder[CreateUpdateMock] = CreateUpdateMock.decoder(settings.mock)

  private def routes: HttpRoutes[IO] = HttpRoutes.of[IO] {

    /*
     * Describe the API to whoever asks.
     *
     * The web UI is a single-page app, so a caller that is not a browser — a script, or an agent
     * handed nothing but a URL — has no way to learn what this service accepts. This is the one
     * place such a caller can reach without a checkout, so it answers the questions that
     * otherwise require reading the source: what the endpoints are, that a mock is owned by a
     * secret the caller chooses, and how long a mock lives.
     */
    case GET -> Root / "api" =>
      Ok(ApiDescription.json(settings.endpoint, Expiration.Default.entryName))

    // Create new mock
    case req @ POST -> Root / "api" / "mock" =>
      decodeJson[IO, CreateUpdateMock](req) { createMock =>
        for {
          created <- repository.insert(createMock.withIp(HttpUtil.getIP(req)))
          mock = MockCreatedResponse(created, createMock, settings.endpoint)
          response <- Created(mock)
        } yield response
      }

    // Get an existing mock
    case GET -> Root / "api" / "mock" / UUIDVar(id) =>
      repository.get(id).flatMap {
        case Left(MockNotFoundError) => NotFound()
        case Right(mock) => Ok(mock)
      }

    // Get the stats of a mock
    case GET -> Root / "api" / "mock" / UUIDVar(id) / "stats" =>
      repository.stats(id).flatMap {
        case Left(MockNotFoundError) => NotFound()
        case Right(stats) => Ok(stats)
      }

    // Update an existing mock
    case req @ PUT -> Root / "api" / "mock" / UUIDVar(id) =>
      decodeJson[IO, CreateUpdateMock](req) { updateMock =>
        for {
          updated <- repository.update(id, updateMock.withIp(HttpUtil.getIP(req)))
          response <- if (updated) NoContent() else NotFound()
        } yield response
      }

    // Delete an existing mock
    case req @ DELETE -> Root / "api" / "mock" / UUIDVar(id) =>
      decodeJson[IO, DeleteMock](req) { deleteMock =>
        for {
          deleted <- repository.delete(id, deleteMock)
          response <- if (deleted) NoContent() else NotFound()
        } yield response
      }

    // Requests captured by a mock, newest first. The secret travels in the body rather than the
    // query string so a credential does not end up in access logs.
    case req @ POST -> Root / "api" / "mock" / UUIDVar(id) / "requests" =>
      decodeJson[IO, ListCaptures](req) { list =>
        repository.ownsMock(id, list.secret).flatMap {
          case false => NotFound()
          case true =>
            repository.listCaptures(id, list.perPage, (list.page - 1) * list.perPage).flatMap {
              case (items, total, captureLimit) =>
                Ok(
                  Json.obj(
                    "items" -> items.asJson,
                    "total" -> total.asJson,
                    "page" -> list.page.asJson,
                    "per_page" -> list.perPage.asJson,
                    "capture_limit" -> captureLimit.asJson
                  )
                )
            }
        }
      }

    // Clear a mock's captured requests, keeping the mock itself
    case req @ POST -> Root / "api" / "mock" / UUIDVar(id) / "requests" / "clear" =>
      decodeJson[IO, DeleteMock](req) { auth =>
        repository.ownsMock(id, auth.secret).flatMap {
          case false => NotFound()
          case true => repository.clearCaptures(id) *> NoContent()
        }
      }

    // Remove a single captured request
    case req @ POST -> Root / "api" / "mock" / UUIDVar(id) / "requests" / "delete" =>
      decodeJson[IO, DeleteCapture](req) { target =>
        repository.ownsMock(id, target.secret).flatMap {
          case false => NotFound()
          case true =>
            scala.util.Try(java.util.UUID.fromString(target.id)).toOption match {
              case None => NotFound()
              case Some(captureId) =>
                repository.deleteCapture(id, captureId).flatMap {
                  case true => NoContent()
                  case false => NotFound()
                }
            }
        }
      }

    // Turn capture on or off for a mock
    case req @ POST -> Root / "api" / "mock" / UUIDVar(id) / "capture" =>
      decodeJson[IO, SetCapture](req) { setting =>
        repository.setCaptureLimit(id, setting.limit, setting.secret).flatMap {
          case true => NoContent()
          case false => NotFound()
        }
      }

    // Check if a mock can be deleted with this secret
    case req @ POST -> Root / "api" / "mock" / UUIDVar(id) / "check" =>
      decodeJson[IO, DeleteMock](req) { deleteMock =>
        for {
          result <- repository.checkDeletionSecret(id, deleteMock)
          response <- Ok(result)
        } yield response
      }

  }

}
