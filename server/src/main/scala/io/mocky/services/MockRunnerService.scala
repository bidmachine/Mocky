package io.mocky.services

import cats.effect.{ IO, Timer }
import org.http4s._
import org.http4s.dsl.Http4sDsl
import org.http4s.server.middleware.CORS

import io.mocky.config.Settings
import io.mocky.http.HttpMockResponse
import io.mocky.http.middleware.{ CaptureRequest, Jsonp, Sleep }
import io.mocky.models.errors.MockNotFoundError
import io.mocky.repositories.{ MockV2Repository, MockV3Repository }
import io.mocky.utils.HttpUtil

/**
  * Play V2 and V3 mocks
  */
class MockRunnerService(repoV2: MockV2Repository, repoV3: MockV3Repository, settings: Settings)(implicit
  timer: Timer[IO])
    extends Http4sDsl[IO]
    with HttpMockResponse {

  // Expose the routes wrapped into their middleware
  val routing: HttpRoutes[IO] = CORS(new Sleep(settings.sleep)(Jsonp(routes)))

  private def routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    // Fetch and play a legacy mock
    case _ -> "v2" /: id /: _ =>
      repoV2.touchAndGetMockResponse(id).flatMap {
        case Left(MockNotFoundError) => NotFound()
        case Right(mock) => respondWithMock(mock)
      }

    // Fetch and play a "last version" mock, recording the call when the mock captures
    case req @ _ -> "v3" /: UUIDVar(id) /: suffix =>
      // Passed unevaluated: the repository reads the body only for a mock that actually captures,
      // so a plain call — or one to an id that does not exist — never buffers the payload.
      val played =
        repoV3.touchCaptureAndGetMockResponse(
          id,
          CaptureRequest.from(req, suffix.toString, settings.capture),
          HttpUtil.getIP(req)
        )

      played.flatMap {
        case Left(MockNotFoundError) => NotFound()
        case Right(mock) => respondWithMock(mock)
      }
  }
}
