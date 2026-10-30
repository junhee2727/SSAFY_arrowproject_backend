# Repository Guidelines

## Project Structure & Module Organization

- `Frontend/` contains the static EnjoyTrip application. Start at `pages/map.html`; `index.html` is a placeholder.
- `Frontend/js/` contains browser ES modules for tourism search, Kakao maps, route optimization, and weather. Authentication and board features live in `js/auth/` and `js/board/`.
- `Frontend/css/`, `resources/`, and `pages/` hold styles, images/icons, and HTML pages or shared fragments. `Frontend/docs/` holds requirements, design guidance, and screenshots.
- `Frontend/tests/*.test.js` contains automated tests. Backend implementation must satisfy the requirements in `Backend/Docs/` (the actual directory name is capitalized).
- Organize the backend as a Maven WAR project under `Backend/`, with Java in `src/main/java` and JSP/web resources in `src/main/webapp`, relative to its Maven project root. No `pom.xml` is present in the current checkout; inspect the actual project before configuring it.

## Backend Technology & Architecture

- Use Java 25, Maven WAR packaging, and Apache Tomcat 11. Set `maven-compiler-plugin` version `3.15.0` with `release` set to `25`, and `maven-war-plugin` version `3.5.1`.
- Declare `jakarta.servlet:jakarta.servlet-api:6.1.0` with `provided` scope. Use `jakarta.servlet` imports, never `javax.servlet`.
- Use JSTL API `jakarta.servlet.jsp.jstl:jakarta.servlet.jsp.jstl-api:3.0.2` and implementation `org.glassfish.web:jakarta.servlet.jsp.jstl:3.0.1`; package both with the application.
- If JSP APIs are needed on the development/build classpath, declare `jakarta.servlet.jsp:jakarta.servlet.jsp-api:4.0.0` with `provided` scope.
- Set source, JSP, and HTTP request/response encoding to UTF-8. Configure request encoding before reading parameters and response encoding before obtaining a writer.
- Follow `Controller (Servlet) → Service → DAO → DTO`. Controllers handle HTTP flow, services own business logic, DAOs manage storage, and DTOs carry data. Keep business/storage logic out of JSPs.
- Retain the example's singleton services and in-memory DAOs. Account for concurrent servlet requests when sharing mutable state. Do not introduce a database until explicitly requested, or migrate to Spring Boot or another framework.
- The existing Eclipse Dynamic Web Module Facet is reported as `6.0`, while the target Servlet API is `6.1`. Inspect Eclipse metadata and tooling support, explain any mismatch and proposed change, then align the facet/runtime configuration as needed.

## Build, Test, and Development Commands

Before backend work on macOS, run `java -version` and `mvn -version` to verify the JDK actually used by both commands. Check `/usr/libexec/java_home -V`, `JAVA_HOME`, and the installed Tomcat location/version; do not assume Homebrew paths or a running server. Use JDK 25 for Maven rather than lowering the compiler release to accommodate an older JDK.

Once the Maven project exists, run `mvn test` for tests and `mvn clean package` to build its WAR from the directory containing `pom.xml`. Configure and document deployment of `target/*.war` against the actual local Tomcat 11 installation, including its `CATALINA_BASE`, context path, and startup method.

Run from the repository root:

```sh
cp Frontend/config.env.example Frontend/config.env
python3 -m http.server 5500 --bind 127.0.0.1 --directory Frontend
```

Copy the configuration once, fill in the keys, then open `http://127.0.0.1:5500/pages/map.html`. Python 3 serves only the static frontend; it cannot execute Servlets or JSPs. No frontend build step or dependency installation is configured.

```sh
node --test Frontend/tests/*.test.js
node --test Frontend/tests/route-optimizer.test.js
```

With Node.js installed, these run the full suite or one focused test file.

## Coding Style & Naming Conventions

Use two-space indentation, double-quoted JavaScript strings, semicolons, and explicit `.js` import extensions. Use camelCase identifiers, uppercase configuration constants, and kebab-case filenames/CSS classes. Preserve DOM integration IDs such as `selectSido` and `btn_trip_search`.

Use Bootstrap for new UI work, reuse existing CSS variables, and load project styles after Bootstrap. No formatter or linter is configured; match surrounding code.

## Testing Guidelines

Place backend tests in `src/test/java` and document the selected test framework when introduced. Validate service/DAO behavior and Servlet/JSP flows on Tomcat 11, including Korean text round trips through UTF-8 requests and responses.

Frontend tests use `node:test`, strict assertions, and VM-based browser/API mocks. Name files `<feature>.test.js` and describe observable behavior in test names. Add regression cases for changed logic, including error states and boundary conditions. No coverage threshold is configured.

For UI changes, also check keyboard navigation, map/search behavior, and responsive layouts at 1440px, 820px, and 390px.

## Commit & Pull Request Guidelines

History contains only `commit` and `delete: readme.md`, so no consistent convention is established. Prefer concise, scoped subjects such as `fix: preserve locked trip stops`. PRs should describe behavior changes, link relevant issues or requirements, report validation, and include screenshots for UI changes.

## Security & Configuration

`js/keys.js` loads `Frontend/config.env`. Tourism and map keys are required; route and weather keys are optional. Keep this ignored file uncommitted. Its contents are browser-accessible: never store server secrets there, and restrict API keys appropriately.
