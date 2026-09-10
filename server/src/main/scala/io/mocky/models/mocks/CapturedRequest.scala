package io.mocky.models.mocks

import java.sql.Timestamp
import java.time.ZoneOffset
import java.util.UUID

import io.circe.syntax._
import io.circe.{ Encoder, Json }

/**
  * A request that arrived on a mock's URL and was recorded.
  *
  * The body is kept as bytes so that a binary payload survives the round trip; it is exposed as
  * text when it decodes as UTF-8, and as base64 otherwise, rather than being mangled into
  * unreadable characters.
  */
final case class CapturedRequest(
  // Assigned by the database on insert; a request on its way in does not have one yet
  id: UUID = new UUID(0L, 0L),
  method: String,
  path: String,
  query: Option[String],
  headers: Json,
  body: Option[Array[Byte]],
  bodySize: Int,
  truncated: Boolean,
  contentType: Option[String],
  receivedAt: Timestamp)

object CapturedRequest {

  implicit private val encodeTimestamp: Encoder[Timestamp] =
    Encoder[String].contramap(_.toInstant.atZone(ZoneOffset.UTC).toString)

  implicit val encoder: Encoder[CapturedRequest] = Encoder.instance { req =>
    Json.obj(
      "id" -> req.id.toString.asJson,
      "method" -> req.method.asJson,
      "path" -> req.path.asJson,
      "query" -> req.query.asJson,
      "headers" -> req.headers,
      "content_type" -> req.contentType.asJson,
      "body" -> decodedBody(req).asJson,
      "body_encoding" -> bodyEncoding(req).asJson,
      "body_size" -> req.bodySize.asJson,
      "truncated" -> req.truncated.asJson,
      "received_at" -> req.receivedAt.asJson
    )
  }

  /** Text when the stored bytes are valid UTF-8, base64 when they are not. */
  private def decodedBody(req: CapturedRequest): Option[String] =
    req.body.map { bytes =>
      asUtf8(bytes).getOrElse(java.util.Base64.getEncoder.encodeToString(bytes))
    }

  private def bodyEncoding(req: CapturedRequest): Option[String] =
    req.body.map(bytes => if (asUtf8(bytes).isDefined) "utf-8" else "base64")

  private def asUtf8(bytes: Array[Byte]): Option[String] = {
    val decoder = java.nio.charset.StandardCharsets.UTF_8
      .newDecoder()
      .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
      .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)

    try Some(decoder.decode(java.nio.ByteBuffer.wrap(bytes)).toString)
    catch { case _: java.nio.charset.CharacterCodingException => None }
  }
}
