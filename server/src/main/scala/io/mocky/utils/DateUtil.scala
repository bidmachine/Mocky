package io.mocky.utils

import java.sql.Timestamp
import java.time.{ LocalDateTime, ZoneId, ZonedDateTime }
import scala.concurrent.duration.FiniteDuration

object DateUtil {
  private val UTC = ZoneId.of("UTC")

  def now: Timestamp = Timestamp.valueOf(LocalDateTime.now())

  def future(period: FiniteDuration): ZonedDateTime = {
    ZonedDateTime.now().plusDays(period.toDays)
  }

  /**
    * A cut-off in the past, used to expire captured requests.
    *
    * Unlike `future`, this keeps sub-day precision: a retention of a few hours has to mean what
    * it says, and truncating it to whole days would silently round it to zero.
    */
  def past(period: FiniteDuration): Timestamp =
    Timestamp.from(java.time.Instant.now().minusSeconds(period.toSeconds))

  def toTimestamp(zdt: ZonedDateTime) = Timestamp.valueOf(zdt.withZoneSameInstant(UTC).toLocalDateTime)
}
