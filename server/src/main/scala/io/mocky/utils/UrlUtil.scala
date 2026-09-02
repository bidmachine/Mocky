package io.mocky.utils

object UrlUtil {

  private val SchemeRegex = "^[a-zA-Z][a-zA-Z0-9+.-]*://".r

  /**
    * Normalize a configured endpoint so it can safely be used as the prefix of an absolute mock link.
    *
    * Without this, an endpoint configured without a scheme (ex: `MOCKY_ENDPOINT=mocky.example.com`)
    * produces a *relative* link. The browser then resolves it against the page currently opened,
    * and the host ends up duplicated (`https://mocky.example.com/mocky.example.com/v3/<id>`).
    *
    *   - adds the `https://` scheme when none is provided
    *   - removes the trailing slashes, to avoid `//v3/<id>`
    */
  def normalizeEndpoint(endpoint: String): String = {
    val trimmed = endpoint.trim
    val absolute = if (SchemeRegex.findFirstIn(trimmed).isDefined) trimmed else s"https://$trimmed"
    absolute.replaceAll("/+$", "")
  }
}
