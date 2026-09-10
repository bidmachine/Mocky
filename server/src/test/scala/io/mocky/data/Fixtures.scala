package io.mocky.data

import io.mocky.config._
import scala.concurrent.duration._

object Fixtures {

  val settings = Settings(
    environment = "prod",
    endpoint = "https://run.mocky.io",
    mock = MockSettings(1000000, 1000),
    capture = CaptureSettings(65536, 1048576, 50, 100, 7.days),
    security = SecuritySettings(14),
    throttle = ThrottleSettings(100, 1.seconds, 10000),
    sleep = SleepSettings(60.seconds, "mocky-delay"),
    cors = CorsSettings("mocky.io"),
    admin = AdminSettings("X-Auth-Token", "secret")
  )
}
