package io.mocky.http.middleware

import java.sql.Timestamp

import cats.effect.IO
import io.circe.Json
import io.circe.syntax._
import org.http4s.Request

import io.mocky.config.CaptureSettings
import io.mocky.models.mocks.CapturedRequest
import io.mocky.utils.DateUtil

/**
  * Turns an incoming request into the record stored alongside a mock.
  *
  * Reading the body at all is new: the runner has always ignored it, so nothing in the pipeline
  * caps how much a caller may send. Everything here is therefore bounded — the body is read up to
  * `maxBodyRead` and kept up to `maxBodyStored` — and a payload past those limits is truncated and
  * flagged rather than rejected, because the mock still has to play its response.
  */
object CaptureRequest {

  def from(req: Request[IO], mockPath: String, settings: CaptureSettings): IO[CapturedRequest] =
    body(req, settings).map {
      case (bytes, size, truncated) =>
        CapturedRequest(
          method = req.method.name,
          path = mockPath,
          query = Option(req.uri.query.renderString).filter(_.nonEmpty),
          headers = headers(req, settings),
          body = Option(bytes).filter(_.nonEmpty),
          bodySize = size,
          truncated = truncated,
          contentType = req.contentType.map(_.value),
          receivedAt = receivedAt
        )
    }

  private def receivedAt: Timestamp = DateUtil.now

  /**
    * Read the body, stopping at the read limit so a large upload cannot be buffered whole.
    *
    * `Content-Length` is deliberately not trusted for the size: it is absent on a chunked request
    * and a caller may simply lie, so the count comes from the bytes actually read.
    */
  private def body(req: Request[IO], settings: CaptureSettings): IO[(Array[Byte], Int, Boolean)] =
    req.body
      .take(settings.maxBodyRead.toLong + 1)
      .compile
      .to(Array)
      .map { read =>
        val overRead = read.length > settings.maxBodyRead
        val kept = read.take(settings.maxBodyStored)
        val truncated = overRead || read.length > settings.maxBodyStored

        (kept, read.length.min(settings.maxBodyRead), truncated)
      }

  /**
    * Headers as a JSON object, capped in count.
    *
    * Repeated headers are joined with ", " as HTTP itself allows, so a `Set-Cookie` sent twice is
    * visible rather than silently replaced.
    */
  private def headers(req: Request[IO], settings: CaptureSettings): Json =
    req.headers.toList
      .take(settings.maxHeaders)
      .groupBy(_.name.value)
      .map { case (name, values) => name -> values.map(_.value).mkString(", ") }
      .asJson
}
