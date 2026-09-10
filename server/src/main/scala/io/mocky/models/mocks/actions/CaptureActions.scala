package io.mocky.models.mocks.actions

import io.circe.Decoder

/**
  * Read a page of a mock's captured requests.
  *
  * The secret is part of the payload rather than the query string: it is a credential, and a query
  * string ends up in access logs and browser history.
  */
final case class ListCaptures(secret: String, page: Int, perPage: Int)

object ListCaptures {
  private val DefaultPerPage = 50
  private val MaxPerPage = 100

  implicit val decoder: Decoder[ListCaptures] = Decoder.instance { c =>
    for {
      secret <- c.downField("secret").as[String]
      page <- c.downField("page").as[Option[Int]]
      perPage <- c.downField("per_page").as[Option[Int]]
    } yield ListCaptures(
      secret = secret,
      page = page.filter(_ > 0).getOrElse(1),
      perPage = perPage.filter(_ > 0).map(_.min(MaxPerPage)).getOrElse(DefaultPerPage)
    )
  }
}

/** Remove a single captured request, addressed by its own id. */
final case class DeleteCapture(secret: String, id: String)

object DeleteCapture {
  implicit val decoder: Decoder[DeleteCapture] = Decoder.instance { c =>
    for {
      secret <- c.downField("secret").as[String]
      id <- c.downField("id").as[String]
    } yield DeleteCapture(secret, id)
  }
}

/**
  * Turn capture on or off. `limit` is how many recent requests to keep; 0 disables capture, which
  * is what every mock starts with.
  */
final case class SetCapture(secret: String, limit: Int)

object SetCapture {
  implicit val decoder: Decoder[SetCapture] = Decoder.instance { c =>
    for {
      secret <- c.downField("secret").as[String]
      limit <- c.downField("limit").as[Int]
    } yield SetCapture(secret, limit)
  }
}
