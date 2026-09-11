import Dependencies._
import com.typesafe.sbt.packager.MappingsHelper.directory

lazy val root = (project in file("."))
  .settings(
    name := "mocky-2020",
    version in ThisBuild := "3.0.3",
    scalaVersion := "2.13.2",
    maintainer := "yotsumi.fx+github@gmail.com",
    resolvers += "Tabmo Myget Public" at "https://www.myget.org/F/tabmo-public/maven/",
    libraryDependencies ++= (http4s ++ circe ++ doobie ++ pureconfig ++ log ++ cache ++ enumeratum ++ scalatest),
    addCompilerPlugin("org.typelevel" %% "kind-projector" % "0.10.3"),
    addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1")
    // Allow to temporary disable Fatal-Warning (can be useful during big refactoring)
    //scalacOptions -= "-Xfatal-warnings"
  )
  // Package with resources
  .enablePlugins(JavaAppPackaging)
  .settings(mappings in Universal ++= directory("src/main/resources"))
  // sbt-native-packager defaults the Docker base image to `openjdk:8`, which Docker Hub has
  // since removed — the official `openjdk` images are archived and the 8 tags are gone, so the
  // build failed resolving them. Temurin is the Adoptium successor and still publishes Java 8.
  .settings(dockerBaseImage := "eclipse-temurin:8-jre")
  // Make build information available at runtime
  .enablePlugins(BuildInfoPlugin)
  .settings(Seq(
    buildInfoKeys := Seq[BuildInfoKey](name, version),
    buildInfoOptions += BuildInfoOption.BuildTime
  ))
  // Activate Integration Tests
  .configs(IntegrationTest) // Affect the same settings to integration test module
  .settings(Defaults.itSettings) // Allows to run it: tasks

// Automatically reload project when build files are modified
Global / onChangedBuildSource := ReloadOnSourceChanges
