package io.mocky.models.mocks.enums
import scala.concurrent.duration._

import enumeratum._

sealed abstract class Expiration(override val entryName: String, val duration: Option[FiniteDuration]) extends EnumEntry

object Expiration extends Enum[Expiration] with CirceEnum[Expiration] {

  override val values: IndexedSeq[Expiration] = findValues

  case object Never extends Expiration("never", None)
  case object `1day` extends Expiration("1day", Some(1.day))
  case object `1week` extends Expiration("1week", Some(7.days))
  case object `2weeks` extends Expiration("2weeks", Some(14.days))
  case object `1month` extends Expiration("1month", Some(31.days))
  case object `1year` extends Expiration("1year", Some(361.days))

  /**
    * What a mock gets when nobody chose. A caller that omits `expiration` is almost always a
    * script or an agent rather than a person, and a mock nobody named an end for is exactly the
    * kind that stays in the table forever.
    */
  val Default: Expiration = `2weeks`
}
