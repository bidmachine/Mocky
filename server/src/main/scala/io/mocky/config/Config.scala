package io.mocky.config

import scala.concurrent.duration._

import cats.effect.{ Blocker, ContextShift, IO, Resource }
import com.typesafe.config.ConfigFactory
import pureconfig._
import pureconfig.generic.auto._
import pureconfig.module.catseffect.syntax._

sealed case class ServerConfig(host: String, port: Int)

sealed case class DatabaseConfig(driver: String, url: String, user: String, password: String, threadPoolSize: Int = 8) {
  assert(threadPoolSize >= 4)
}

sealed case class ThrottleSettings(amount: Int, per: FiniteDuration, maxClients: Long) {
  assert(amount > 20)
  assert(maxClients > 100)
}

case class SleepSettings(maxDelay: FiniteDuration, parameter: String) {
  assert(maxDelay < 5.minutes)
}

sealed case class MockSettings(
  contentMaxLength: Int,
  secretMaxLength: Int
) {
  assert(contentMaxLength > 1000 && contentMaxLength < 10000000)
}

/**
  * Limits on recording incoming requests. `maxBodyRead` bounds what is pulled off the wire at all;
  * `maxBodyStored` bounds what is kept. The read limit exists because nothing else in the request
  * pipeline caps an incoming body.
  */
sealed case class CaptureSettings(
  maxBodyStored: Int,
  maxBodyRead: Int,
  maxHeaders: Int,
  maxPerMock: Int,
  retention: FiniteDuration
) {
  assert(maxBodyStored > 0 && maxBodyStored <= maxBodyRead)
  assert(maxBodyRead > 0 && maxBodyRead <= 10000000)
  assert(maxHeaders > 0 && maxHeaders <= 200)
  assert(maxPerMock > 0 && maxPerMock <= 10000)
  assert(retention > Duration.Zero)
}

sealed case class SecuritySettings(bcryptIterations: Int) {
  assert(bcryptIterations >= 4 && bcryptIterations <= 31)
}

sealed case class AdminSettings(header: String, password: String) {
  assert(header.nonEmpty)
  assert(password.nonEmpty)
}

sealed case class CorsSettings(domain: String, devDomains: Option[Seq[String]] = None) {
  assert(domain.nonEmpty)
}

sealed case class Settings(
  environment: String,
  endpoint: String,
  cors: CorsSettings,
  mock: MockSettings,
  capture: CaptureSettings,
  security: SecuritySettings,
  throttle: ThrottleSettings,
  sleep: SleepSettings,
  admin: AdminSettings)

sealed case class Config(server: ServerConfig, database: DatabaseConfig, settings: Settings)

object Config {
  def load(configFile: String)(implicit cs: ContextShift[IO]): Resource[IO, Config] = {
    Blocker[IO].flatMap { blocker =>
      Resource.liftF(ConfigSource.fromConfig(ConfigFactory.load(configFile)).loadF[IO, Config](blocker))
    }
  }
}
