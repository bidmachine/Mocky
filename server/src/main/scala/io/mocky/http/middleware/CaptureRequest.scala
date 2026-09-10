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
    * Headers whose value is replaced by a marker.
    *
    * The point of the capture log is to show what a caller sent, but a bearer token pasted into
    * a debugging session should not outlive it in a database, in every backup, and in the reply
    * to anyone holding the mock's secret. The name is kept — knowing the header was sent is the
    * useful part — and the value is not.
    */
  private val Redacted = Set("authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key")

  private val RedactedMarker = "<redacted>"

  /**
    * Headers as a JSON object, capped in count.
    *
    * Repeated headers are joined with ", " as HTTP itself allows, so a `Set-Cookie` sent twice is
    * visible rather than silently replaced. The cap is applied after grouping, so fifty repeats
    * of one header cannot crowd out every other name.
    */
  private def headers(req: Request[IO], settings: CaptureSettings): Json =
    req.headers.toList
      .groupBy(_.name.value)
      .toList
      .sortBy(_._1)
      .take(settings.maxHeaders)
      .map {
        case (name, values) =>
          val value =
            if (Redacted.contains(name.toLowerCase)) RedactedMarker
            else values.map(_.value).mkString(", ")
          name -> value
      }
      .toMap
      .asJson
}
