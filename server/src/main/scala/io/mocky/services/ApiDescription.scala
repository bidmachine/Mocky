package io.mocky.services

import io.circe.Json
import io.circe.syntax._

/**
  * What `GET /api` answers.
  *
  * Written for a caller that arrived with only a URL: no checkout, no documentation, and no
  * account to log into. It states the two things that are surprising about this service — a mock
  * is owned by a secret the caller invents, and a mock created without an expiration is deleted
  * after a fixed lifetime — because both are cheaper to learn here than by experiment.
  */
object ApiDescription {

  def json(endpoint: String, defaultExpiration: String): Json =
    Json.obj(
      "service" -> "mocky".asJson,
      "description" -> "Create an HTTP endpoint that returns a canned response, and optionally log what is sent to it.".asJson,
      "documentation" -> "https://github.com/bidmachine/Mocky/blob/main/AGENTS.md".asJson,
      "authentication" -> Json.obj(
        "model" -> "secret".asJson,
        "detail" -> ("There are no accounts. You choose a `secret` when creating a mock; it is required to " +
          "update, delete, or read the capture log. It cannot be recovered, so keep it.").asJson
      ),
      "mock_lifetime" -> Json.obj(
        "default" -> defaultExpiration.asJson,
        "detail" -> ("A mock created without an `expiration` is deleted after the default lifetime, along with " +
          "anything it captured. Pass \"never\" for a mock you intend to keep.").asJson,
        "values" -> List("never", "1day", "1week", "2weeks", "1month", "1year").asJson
      ),
      "endpoints" -> Json.arr(
        endpointJson("POST", "/api/mock", "Create a mock. Returns its id, secret and a ready-to-use link.", secret = false),
        endpointJson("GET", "/api/mock/{id}", "Read a mock's definition.", secret = false),
        endpointJson("PUT", "/api/mock/{id}", "Replace a mock. Sends the whole mock, not a patch.", secret = true),
        endpointJson("DELETE", "/api/mock/{id}", "Delete a mock.", secret = true),
        endpointJson("GET", "/api/mock/{id}/stats", "How many times the mock was called.", secret = false),
        endpointJson("POST", "/api/mock/{id}/capture", "Turn request capture on or off, via `limit`.", secret = true),
        endpointJson("POST", "/api/mock/{id}/requests", "Read captured requests, newest first.", secret = true),
        endpointJson("POST", "/api/mock/{id}/requests/clear", "Delete every captured request.", secret = true),
        endpointJson("POST", "/api/mock/{id}/requests/delete", "Delete one captured request.", secret = true)
      ),
      "play_url" -> Json.obj(
        "pattern" -> s"$endpoint/v3/{id}".asJson,
        "detail" -> "Accepts any method and any path suffix; the mock responds the same to all of them.".asJson
      ),
      "notes" -> Json.arr(
        "A mock created through the API does not appear in the web UI: that list is the browser's local storage, not an account.".asJson
      )
    )

  private def endpointJson(method: String, path: String, description: String, secret: Boolean): Json =
    Json.obj(
      "method" -> method.asJson,
      "path" -> path.asJson,
      "description" -> description.asJson,
      "requires_secret" -> secret.asJson
    )
}
