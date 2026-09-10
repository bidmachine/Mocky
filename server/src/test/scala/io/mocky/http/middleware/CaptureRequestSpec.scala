package io.mocky.http.middleware

import java.nio.charset.StandardCharsets.UTF_8

import cats.effect.IO
import fs2.Stream
import io.circe.syntax._
import org.http4s._
import org.http4s.implicits._
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

import io.mocky.config.CaptureSettings
import io.mocky.models.mocks.CapturedRequest

class CaptureRequestSpec extends AnyWordSpec with Matchers {

  private val settings = CaptureSettings(
    maxBodyStored = 32,
    maxBodyRead = 128,
    maxHeaders = 3,
    maxPerMock = 100,
    retention = scala.concurrent.duration.Duration(7, "days")
  )

  private def capture(req: Request[IO], path: String = "/hook"): CapturedRequest =
    CaptureRequest.from(req, path, settings).unsafeRunSync()

  private def withBody(bytes: Array[Byte]): Request[IO] =
    Request[IO](Method.POST, uri"/v3/abc/hook").withBodyStream(Stream.emits(bytes).covary[IO])

  "CaptureRequest" should {

    "record the method, path and query of a call" in {
      val req = Request[IO](Method.PUT, uri"/v3/abc/hook?event=bid.won&src=dsp")
      val captured = capture(req)

      captured.method shouldBe "PUT"
      captured.path shouldBe "/hook"
      captured.query shouldBe Some("event=bid.won&src=dsp")
    }

    "leave the query empty when the mock was called on its bare URL" in {
      capture(Request[IO](Method.GET, uri"/v3/abc")).query shouldBe None
    }

    "keep a body that fits" in {
      val captured = capture(withBody("""{"a":1}""".getBytes(UTF_8)))

      captured.body.map(new String(_, UTF_8)) shouldBe Some("""{"a":1}""")
      captured.bodySize shouldBe 7
      captured.truncated shouldBe false
    }

    "store no body at all for a request that has none" in {
      val captured = capture(Request[IO](Method.GET, uri"/v3/abc"))

      captured.body shouldBe None
      captured.bodySize shouldBe 0
      captured.truncated shouldBe false
    }

    "truncate a body past the storage limit but report the size that arrived" in {
      val captured = capture(withBody(("x" * 100).getBytes(UTF_8)))

      captured.body.map(_.length) shouldBe Some(32)
      captured.bodySize shouldBe 100
      captured.truncated shouldBe true
    }

    "stop reading at the read limit, so an unbounded upload cannot be buffered whole" in {
      // Well past maxBodyRead: the count must cap rather than report the true length
      val captured = capture(withBody(("y" * 5000).getBytes(UTF_8)))

      captured.body.map(_.length) shouldBe Some(32)
      captured.bodySize shouldBe 128
      captured.truncated shouldBe true
    }

    "replace a credential header's value with a marker" in {
      // The log is read by anyone holding the mock's secret and sits in every backup; a token
      // pasted in while debugging should not outlive the session.
      val req = Request[IO](
        method = Method.POST,
        uri = uri"/v3/abc",
        headers = Headers.of(
          Header("Authorization", "Bearer super-secret-token"),
          Header("X-Trace", "keep-me")
        )
      )

      val recorded = capture(req).headers.asObject

      recorded.flatMap(_("Authorization")).flatMap(_.asString) shouldBe Some("<redacted>")
      recorded.flatMap(_("X-Trace")).flatMap(_.asString) shouldBe Some("keep-me")
    }

    "redact regardless of how the header is cased" in {
      val req = Request[IO](
        method = Method.POST,
        uri = uri"/v3/abc",
        headers = Headers.of(Header("cookie", "session=abc123"))
      )

      capture(req).headers.asObject.flatMap(_("cookie")).flatMap(_.asString) shouldBe Some("<redacted>")
    }

    "cap how many headers are recorded" in {
      val req = Request[IO](
        Method.POST,
        uri"/v3/abc",
        headers = Headers.of(
          Header("X-One", "1"),
          Header("X-Two", "2"),
          Header("X-Three", "3"),
          Header("X-Four", "4"),
          Header("X-Five", "5")
        )
      )

      capture(req).headers.asObject.map(_.size) shouldBe Some(3)
    }

    "join a header that was sent more than once, rather than dropping one" in {
      val req = Request[IO](
        Method.POST,
        uri"/v3/abc",
        headers = Headers.of(Header("X-Multi", "a"), Header("X-Multi", "b"))
      )

      capture(req).headers.asObject.flatMap(_("X-Multi")).flatMap(_.asString) shouldBe Some("a, b")
    }
  }

  "CapturedRequest encoding" should {

    "expose a UTF-8 body as text" in {
      val json = capture(withBody("""{"ok":true}""".getBytes(UTF_8))).asJson

      json.hcursor.get[String]("body") shouldBe Right("""{"ok":true}""")
      json.hcursor.get[String]("body_encoding") shouldBe Right("utf-8")
    }

    "fall back to base64 for bytes that are not valid UTF-8" in {
      // A lone 0xFF never appears in well-formed UTF-8
      val json = capture(withBody(Array[Byte](0xff.toByte, 0xfe.toByte))).asJson

      json.hcursor.get[String]("body_encoding") shouldBe Right("base64")
      json.hcursor.get[String]("body") shouldBe Right("//4=")
    }

    "report truncation to the client" in {
      val json = capture(withBody(("z" * 100).getBytes(UTF_8))).asJson

      json.hcursor.get[Boolean]("truncated") shouldBe Right(true)
      json.hcursor.get[Int]("body_size") shouldBe Right(100)
    }
  }
}
