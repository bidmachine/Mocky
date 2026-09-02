package io.mocky.utils

import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

class UrlUtilSpec extends AnyWordSpec with Matchers {

  "UrlUtil.normalizeEndpoint" should {

    "keep an already absolute endpoint untouched" in {
      UrlUtil.normalizeEndpoint("https://run.mocky.io") shouldBe "https://run.mocky.io"
      UrlUtil.normalizeEndpoint("http://0.0.0.0:8080") shouldBe "http://0.0.0.0:8080"
    }

    "add the https scheme when the endpoint has none" in {
      UrlUtil.normalizeEndpoint("mocky.example.com") shouldBe "https://mocky.example.com"
    }

    "remove trailing slashes to avoid a doubled separator" in {
      UrlUtil.normalizeEndpoint("https://run.mocky.io/") shouldBe "https://run.mocky.io"
      UrlUtil.normalizeEndpoint("https://run.mocky.io///") shouldBe "https://run.mocky.io"
      UrlUtil.normalizeEndpoint("mocky.example.com/") shouldBe "https://mocky.example.com"
    }

    "trim the surrounding whitespaces" in {
      UrlUtil.normalizeEndpoint("  https://run.mocky.io  ") shouldBe "https://run.mocky.io"
    }
  }
}
