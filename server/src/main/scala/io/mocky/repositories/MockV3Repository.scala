package io.mocky.repositories

import java.sql.Timestamp
import java.util.UUID
import scala.annotation.nowarn

import cats.effect.IO
import cats.implicits._
import com.typesafe.scalalogging.StrictLogging
import doobie.implicits._
import doobie.implicits.javasql._
import doobie.postgres.circe.jsonb.implicits._
import doobie.postgres.implicits._
import doobie.util.log.LogHandler
import doobie.{ ConnectionIO, Fragment, Transactor }

import io.mocky.config.{ CaptureSettings, SecuritySettings }
import io.mocky.db.DoobieLogHandler
import io.mocky.http.middleware.Admin
import io.mocky.models.Gate
import io.mocky.models.admin.Stats
import io.mocky.models.errors.MockNotFoundError
import io.mocky.models.mocks._
import io.mocky.models.mocks.actions.{ CreateUpdateMock, DeleteMock }
import io.mocky.models.mocks.feedbacks.MockCreated
import io.mocky.utils.DateUtil

class MockV3Repository(
  transactor: Transactor[IO],
  securityConfig: SecuritySettings,
  captureConfig: CaptureSettings)
    extends DoobieLogHandler
    with StrictLogging {

  implicit val log: LogHandler = doobieLogHandler

  private object SQL {
    private val TABLE = Fragment.const("mocks_v3")
    // Higher iterations make the crypt method slower but more secure to brute force attack
    private val BCRYPT_ITER = Fragment.const(securityConfig.bcryptIterations.toString)

    private def encode(str: String): Fragment = fr"encode(digest($str, 'sha256'), 'hex')"
    private def encode(optStr: Option[String]): Fragment = optStr.map(encode).getOrElse(fr"null")

    private def checkSecret(secret: String) = fr"secret_token = crypt($secret, secret_token)"

    def GET(id: UUID): Fragment =
      fr"SELECT content, status, content_type, charset, headers FROM $TABLE WHERE id = $id"

    private val CAPTURES = Fragment.const("mock_requests")

    /** How many captures this mock wants kept; 0 means capture is off. */
    def GET_CAPTURE_LIMIT(id: UUID): Fragment =
      fr"SELECT capture_limit FROM $TABLE WHERE id = $id"

    def INSERT_CAPTURE(mockId: UUID, req: CapturedRequest, hashIp: String): Fragment =
      fr"""
          INSERT INTO $CAPTURES
            (mock_id, method, path, query, headers, body, body_size, truncated, content_type,
             hash_ip, received_at)
          VALUES
            ($mockId, ${req.method}, ${req.path}, ${req.query}, ${req.headers}, ${req.body},
             ${req.bodySize}, ${req.truncated}, ${req.contentType}, ${encode(hashIp)},
             ${req.receivedAt})
      """

    /**
      * Drop what falls outside the mock's window. Runs on insert because the application has no
      * scheduler, which keeps the table bounded without one.
      */
    def TRIM_CAPTURES(mockId: UUID, keep: Int, oldest: Timestamp): Fragment =
      fr"""
          DELETE FROM $CAPTURES
          WHERE mock_id = $mockId
            AND (received_at < $oldest
                 OR id NOT IN (
                   SELECT id FROM $CAPTURES
                   WHERE mock_id = $mockId
                   ORDER BY received_at DESC
                   LIMIT $keep
                 ))
      """

    def LIST_CAPTURES(mockId: UUID, limit: Int, offset: Int): Fragment =
      fr"""
          SELECT method, path, query, headers, body, body_size, truncated, content_type, received_at
          FROM $CAPTURES
          WHERE mock_id = $mockId
          ORDER BY received_at DESC
          LIMIT $limit OFFSET $offset
      """

    def COUNT_CAPTURES(mockId: UUID): Fragment =
      fr"SELECT count(*) FROM $CAPTURES WHERE mock_id = $mockId"

    def DELETE_CAPTURES(mockId: UUID): Fragment =
      fr"DELETE FROM $CAPTURES WHERE mock_id = $mockId"

    def SET_CAPTURE_LIMIT(id: UUID, limit: Int, secret: String): Fragment =
      fr"UPDATE $TABLE SET capture_limit = $limit WHERE id = $id AND ${checkSecret(secret)}"

    def GET_STATS(id: UUID): Fragment =
      fr"SELECT created_at, last_access_at, total_access FROM $TABLE WHERE id = $id"

    def UPDATE_STATS(id: UUID): Fragment =
      fr"UPDATE $TABLE SET last_access_at = ${DateUtil.now}, total_access = total_access + 1 WHERE id = $id"

    def INSERT(mock: CreateUpdateMock): Fragment =
      fr"""
          INSERT INTO $TABLE
            (name, content, content_type, status, charset, headers, created_at, expire_at, total_access, hash_content, secret_token, hash_ip)
          VALUES (
            ${mock.name},
            ${mock.contentArrayBytes},
            ${mock.contentType},
            ${mock.status},
            ${mock.charset},
            ${mock.headersJson},
            ${DateUtil.now},
            ${mock.expireAt.map(DateUtil.toTimestamp)},
            0,
            ${encode(mock.content)},
            crypt(${mock.secret}, gen_salt('bf', $BCRYPT_ITER)),
            ${encode(mock.ip.getOrElse("0.0.0.0"))}
          )
          """

    def UPDATE(id: UUID, mock: CreateUpdateMock): Fragment =
      fr"""
          UPDATE $TABLE
          SET
            name = ${mock.name},
            content = ${mock.contentArrayBytes},
            content_type = ${mock.contentType},
            status = ${mock.status},
            charset = ${mock.charset},
            headers = ${mock.headersJson},
            hash_content = ${encode(mock.content)},
            hash_ip = ${encode(mock.ip.getOrElse("0.0.0.0"))},
            expire_at = ${mock.expireAt.map(DateUtil.toTimestamp)}
          WHERE id = $id AND ${checkSecret(mock.secret)}
      """

    def DELETE(id: UUID, secret: String): Fragment =
      fr"DELETE FROM $TABLE WHERE id = $id and ${checkSecret(secret)}"

    def CHECK_SECRET(id: UUID, secret: String): Fragment =
      fr"SELECT true FROM $TABLE WHERE id = $id and ${checkSecret(secret)}"

    def ADMIN_DELETE(id: UUID): Fragment =
      fr"DELETE FROM $TABLE WHERE id = $id"

    val ADMIN_STATS: Fragment =
      fr"""
          SELECT
            COUNT(*) as nb_mocks,
            SUM(total_access) as total_access,
            SUM(case when last_access_at > NOW() - INTERVAL '1 MONTH' then 1 else 0 end) as nb_mocks_accessed_in_month,
            SUM(case when created_at > NOW() - INTERVAL '1 MONTH' then 1 else 0 end) as nb_mocks_created_in_month,
            SUM(case when last_access_at IS NULL then 1 else 0 end) as nb_mocks_never_accessed,
            SUM(case when last_access_at IS NULL OR  last_access_at < NOW() - INTERVAL '1 YEAR' then 1 else 0 end) as nb_mocks_not_accessed_in_year,
            COUNT(distinct hash_ip) as nb_distinct_ips,
            ROUND(AVG(OCTET_LENGTH(content))) as mock_average_length
          FROM $TABLE
      """
  }

  /**
    * Fetch a V3 mock by its primary key, update its stats and return the Mock response
    */
  def touchAndGetMockResponse(id: UUID): IO[Either[MockNotFoundError.type, MockResponse]] = {
    val queries = for {
      mock <- SQL.GET(id).query[Mock].option
      _ <- SQL.UPDATE_STATS(id).update.run
    } yield mock

    queries.transact(transactor).map {
      case Some(mock) => Right(MockResponse(mock))
      case None => Left(MockNotFoundError)
    }
  }

  /**
    * Play a mock and, when it has capture enabled, record the request that asked for it.
    *
    * The insert joins the transaction that already reads the mock and bumps its stats, so a
    * captured call still costs one connection rather than two — which matters because the pool
    * is small. A mock with `capture_limit = 0` behaves exactly as before.
    */
  def touchCaptureAndGetMockResponse(
    id: UUID,
    request: CapturedRequest,
    hashIp: String
  ): IO[Either[MockNotFoundError.type, MockResponse]] = {
    val oldest = DateUtil.past(captureConfig.retention)

    val queries = for {
      mock <- SQL.GET(id).query[Mock].option
      _ <- SQL.UPDATE_STATS(id).update.run
      limit <- SQL.GET_CAPTURE_LIMIT(id).query[Int].option
      keep = limit.getOrElse(0).min(captureConfig.maxPerMock)
      _ <- if (mock.isDefined && keep > 0) {
             for {
               _ <- SQL.INSERT_CAPTURE(id, request, hashIp).update.run
               trimmed <- SQL.TRIM_CAPTURES(id, keep, oldest).update.run
             } yield trimmed
           } else {
             0.pure[ConnectionIO]
           }
    } yield mock

    queries.transact(transactor).map {
      case Some(mock) => Right(MockResponse(mock))
      case None => Left(MockNotFoundError)
    }
  }

  /**
    * Requests captured for a mock, newest first, with the total so a caller can page through.
    */
  def listCaptures(id: UUID, limit: Int, offset: Int): IO[(List[CapturedRequest], Long)] = {
    val queries = for {
      items <- SQL.LIST_CAPTURES(id, limit, offset).query[CapturedRequest].to[List]
      total <- SQL.COUNT_CAPTURES(id).query[Long].unique
    } yield (items, total)

    queries.transact(transactor)
  }

  /** Clear a mock's capture log, leaving the mock itself untouched. */
  def clearCaptures(id: UUID): IO[Int] =
    SQL.DELETE_CAPTURES(id).update.run.transact(transactor)

  /**
    * Turn capture on or off for a mock. A captured request can hold whatever a caller sent, so
    * reading and changing the log is gated by the same secret that already guards deletion.
    */
  def setCaptureLimit(id: UUID, limit: Int, secret: String): IO[Boolean] =
    SQL
      .SET_CAPTURE_LIMIT(id, limit.min(captureConfig.maxPerMock).max(0), secret)
      .update
      .run
      .transact(transactor)
      .map(_ > 0)

  /** Whether this secret owns the mock, used to gate the capture endpoints. */
  def ownsMock(id: UUID, secret: String): IO[Boolean] =
    SQL.CHECK_SECRET(id, secret).query[Boolean].option.transact(transactor).map(_.isDefined)

  /**
    * Fetch the raw V3 mock
    */
  def get(id: UUID): IO[Either[MockNotFoundError.type, Mock]] = {
    SQL.GET(id).query[Mock].option.transact(transactor).map {
      case Some(mock) => Right(mock)
      case None => Left(MockNotFoundError)
    }
  }

  /**
    * Fetch the stats of the mock (nb times called, last accessed time)
    */
  def stats(id: UUID): IO[Either[MockNotFoundError.type, MockStats]] = {
    SQL.GET_STATS(id).query[MockStats].option.transact(transactor).map {
      case Some(stats) => Right(stats)
      case None => Left(MockNotFoundError)
    }
  }

  /**
    * Insert a new mock
    * @return the uuid of the created mock
    */
  def insert(mock: CreateUpdateMock): IO[MockCreated] = {
    SQL.INSERT(mock).update.withUniqueGeneratedKeys[UUID]("id").transact(transactor)
      .map(MockCreated.apply)
  }

  /**
    * Update an existing mock if the secret is correct
    * @return true if one mock have been updated
    */
  def update(id: UUID, mock: CreateUpdateMock): IO[Boolean] = {
    SQL.UPDATE(id, mock).update.run.transact(transactor)
      .map(affectedRows => affectedRows > 0)
  }

  /**
    * Delete an existing mock if the secret is correct
    * @return true if one mock have been deleted
    */
  def delete(id: UUID, payload: DeleteMock): IO[Boolean] = {
    SQL.DELETE(id, payload.secret).update.run.transact(transactor)
      .map(affectedRows => affectedRows > 0)
  }

  /**
    * Delete a mock without its secret, restricted to admin users
    * @param id Mock to delete
    * @param admin Gate to restrict this  action to admin only
    * @return true if one mock have been deleted
    */
  def adminDelete(id: UUID)(implicit @nowarn admin: Gate[Admin.type]): IO[Boolean] = {
    SQL.ADMIN_DELETE(id).update.run.transact(transactor).map(affectedRows => affectedRows > 0)
  }

  /**
    * Return some global statistics about V3 mocks
    * @param admin Gate to restrict this  action to admin only
    */
  def adminStats()(implicit @nowarn admin: Gate[Admin.type]): IO[Stats] = {
    SQL.ADMIN_STATS.query[Stats].unique.transact(transactor)
  }

  /**
    * Check if the current mock can be updated/deleted with this id/secret
    */
  def checkDeletionSecret(id: UUID, payload: DeleteMock): IO[Boolean] = {
    SQL.CHECK_SECRET(id, payload.secret).query[Boolean].option.transact(transactor).map(_.getOrElse(false))
  }

}
