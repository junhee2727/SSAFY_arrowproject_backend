# EnjoyTrip 회원·게시판 백엔드

기존 EnjoyTrip 화면을 Servlet JSON API에 연결한 Maven WAR 프로젝트입니다. 회원·인증 6개와 자유게시판 5개, 총 11개 API를 구현합니다.

## 구현 범위

- 회원가입, 세션 로그인·로그아웃, 내 정보 조회, 이름 수정, 회원 탈퇴
- 자유게시판 목록·검색·7건 페이징, 상세, 등록·수정·삭제
- 작성자 권한 검사, 이름 변경 시 작성자명 반영, 탈퇴 시 작성 글 삭제
- 기존 지도·관광지 검색·여행계획 코드는 유지합니다. 관광 데이터 API는 기존 브라우저 연동을 사용합니다.

댓글·사진·공지사항·비밀번호 복구·로그인 유지·활동 통계는 최소 API 명세에서 보류한 기능입니다. 해당 조작은 화면에서 제거했고, 공지사항 직접 방문에는 준비 중 안내를 표시합니다.

데이터는 메모리 DAO에 저장합니다. 서버 재시작/재배포 시 회원과 글이 사라집니다. DB, JPA, Spring Boot는 사용하지 않습니다. 회원/글 ID는 현재 API 명세의 문자열 형식(UUID), 목록 번호는 별도의 증가하는 long 값입니다.

## 참고와 구조

- 기준: [Notion API 명세서](https://www.notion.so/40919c9b9e0b80158b3deaf34f1974dc)
- 참고 예제: `BE_06_Project_sol`의 Servlet·Service·DAO 구성
- 예제의 `MemberController/AuthController → MemberService/BasicMemberService → MemberDao` 분리와 singleton 흐름을 따릅니다. 이번 명세는 JSON API이므로 기존 정적 화면을 View로 사용하며, 예제의 action/JSP 화면 이동을 그대로 복사하지 않았습니다.
- 예제 FileMemberDao의 파일 직렬화 대신 저장소 지침에 따라 InMemoryMemberDao/InMemoryBoardDao를 사용합니다.

```text
Backend/
  src/main/java/enjoytrip/
    controller/       # Servlet HTTP 흐름, JSON, 인증 세션
    model/service/    # 검증·권한·회원/게시판 업무 처리
    model/dao/        # 메모리 저장소와 공통 잠금
    model/dto/        # Member·Board 불변 저장 객체
    model/api/        # MemberDto·BoardDto·CommonDto 요청/응답
  src/main/webapp/     # Servlet 6.1 설정과 Tomcat 쿠키 설정
  src/test/java/      # JUnit Jupiter 5.11.4 서비스 회귀 테스트
  scripts/            # 로컬 Tomcat 실행, 실제 HTTP 검증
Frontend/
  js/api.js           # context path를 보존하는 same-origin API 클라이언트
  js/auth/            # 서버 세션 기반 회원 화면
  js/board/           # 서버 게시판 화면
```

이메일 중복 가입과 회원/게시글 연계 변경은 공통 잠금으로 보호합니다. 비밀번호는 회원별 salt와 PBKDF2-HMAC-SHA256 해시로 저장하며 공개 응답 DTO로만 반환합니다. 로그인 성공 시 세션 ID를 바꾸고, 탈퇴한 회원의 기존 세션은 다음 인증 검사에서 거절합니다. 이름·본문은 텍스트로 렌더링합니다.

## 포트와 실행 구성

일반적으로 Tomcat 백엔드는 **8080**, VS Code Live Server는 **5500**을 사용합니다. 이 프로젝트의 현재 실행 안내는 **Tomcat 하나가 127.0.0.1:5500에서 프론트엔드와 API를 함께 제공하는 구성**입니다. Live Server를 함께 실행할 필요는 없습니다.

이 구성은 카카오 JavaScript 키의 등록 origin인 `http://127.0.0.1:5500`과 현재 API 클라이언트의 same-origin 요청을 맞추기 위한 것입니다. Maven으로 만든 WAR에 프론트엔드 파일도 포함됩니다.

| 구성 | 프론트엔드 | 백엔드 | 현재 지원 상태 |
| --- | --- | --- | --- |
| 현재 통합 실행 | Tomcat 5500의 `/enjoytrip/pages/` | 같은 Tomcat 5500의 `/enjoytrip/api/` | 아래 안내대로 실행 |
| 서버 분리 | Live Server 5500 | Tomcat 8080 | API 서버 주소, CORS 및 세션 쿠키 처리 조정 필요 |

Live Server 5500과 Tomcat 8080을 각각 켜는 것만으로 현재 회원·게시판 API가 연결되지는 않습니다. 아래 명령의 **5500은 Live Server 포트가 아니라 프로젝트 Tomcat의 HTTP 포트**입니다.

## Windows 준비

아래 명령은 **Windows PowerShell** 기준입니다. 저장소를 예를 들어 `C:\work\SSAFY_arrowproject_backend`에 내려받고, 실제 설치 경로에 맞게 예제 경로를 수정합니다.

- **JDK 25**: JRE가 아닌 JDK를 설치합니다.
- **Apache Maven**: [공식 설치 안내](https://maven.apache.org/install.html)에 따라 Binary ZIP을 압축 해제합니다.
- **Apache Tomcat 11**: [공식 다운로드](https://tomcat.apache.org/download-11.cgi)에서 Windows용 ZIP 배포본을 받아 압축 해제합니다. 아래에서는 Windows 서비스 대신 `catalina.bat`으로 실행합니다.
- 선택 도구: 프론트엔드 테스트에는 Node.js, HTTP API 검사에는 Python 3가 필요합니다.

예제 설치 폴더는 `C:\dev\jdk-25`, `C:\dev\apache-maven`, `C:\dev\apache-tomcat-11`입니다. 각 폴더 바로 아래에 `bin`이 있어야 합니다.

```powershell
Set-Location "C:\work\SSAFY_arrowproject_backend"
$ProjectRoot = (Get-Location).Path
$env:JAVA_HOME = "C:\dev\jdk-25"
$env:Path = "$env:JAVA_HOME\bin;C:\dev\apache-maven\bin;$env:Path"

java -version
javac -version
mvn -version
```

`java`, `javac`, Maven이 사용하는 Java 버전이 모두 **25**인지 확인합니다. Maven이 다른 JDK를 사용하면 `JAVA_HOME`과 `Path`를 수정하고 compiler release는 25로 유지합니다. 위 환경 변수는 현재 PowerShell 창에 적용되므로 새 창에서는 다시 지정합니다.

## 키 설정과 빌드

저장소 루트에서 설정 파일을 처음 한 번 복사합니다. 기존 설정이 있으면 덮어쓰지 않습니다.

```powershell
if (-not (Test-Path ".\Frontend\config.env")) {
    Copy-Item ".\Frontend\config.env.example" ".\Frontend\config.env"
}
notepad .\Frontend\config.env
```

관광·지도용 브라우저 API 키를 입력하고 저장합니다. 회원·게시판은 이 키가 없어도 동작합니다. 카카오 JavaScript 키에 등록된 사이트 주소는 **`http://127.0.0.1:5500`**이므로 브라우저에서도 같은 호스트·포트를 사용합니다. `localhost:5500`은 다른 origin입니다.

`config.env`는 브라우저에서 읽을 수 있는 공개 API 키 전용 파일이며 Git에 커밋하지 않습니다. 로컬 WAR에도 포함되므로 서버 비밀 키를 넣지 않습니다. 키를 수정하면 WAR를 다시 빌드·배포합니다.

```powershell
Push-Location .\Backend
mvn test
mvn clean package
Pop-Location
```

빌드 성공 후 결과는 `Backend\target\enjoytrip.war`입니다. Maven WAR 설정이 Frontend의 페이지·JS·CSS·리소스를 같은 웹앱에 포함합니다. 프론트엔드 별도 빌드/의존성 설치는 필요하지 않습니다.

## Windows Tomcat 배포와 실행

앞에서 환경 변수를 설정한 **같은 PowerShell 창**, 저장소 루트에서 실행합니다. 설치 폴더인 `CATALINA_HOME`과 프로젝트 실행 폴더인 `CATALINA_BASE`를 분리합니다. Tomcat의 [공식 실행 안내](https://tomcat.apache.org/tomcat-11.0-doc/RUNNING.txt)를 기준으로 구성합니다.

```powershell
$env:CATALINA_HOME = "C:\dev\apache-tomcat-11"
$env:CATALINA_BASE = Join-Path $ProjectRoot "Backend\.runtime\tomcat"
$env:JRE_HOME = $env:JAVA_HOME
$env:CATALINA_OPTS = "-Dfile.encoding=UTF-8"

foreach ($dir in @("conf", "logs", "temp", "webapps", "work")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $env:CATALINA_BASE $dir) | Out-Null
}
if (-not (Test-Path "$env:CATALINA_BASE\conf\server.xml")) {
    Copy-Item "$env:CATALINA_HOME\conf\*" "$env:CATALINA_BASE\conf" -Recurse
}
```

처음 실행하기 전에 다음 명령으로 HTTP 포트를 **5500**, 종료 포트를 **5501**, 바인딩 주소를 **127.0.0.1**로 설정합니다. 이미 실행 중인 Tomcat이 있다면 먼저 종료한 뒤 설정합니다.

```powershell
$serverXmlPath = Join-Path $env:CATALINA_BASE "conf\server.xml"
[xml]$serverXml = Get-Content -LiteralPath $serverXmlPath -Raw
$serverXml.Server.SetAttribute("port", "5501")
$serverXml.Server.SetAttribute("address", "127.0.0.1")
$httpConnector = $serverXml.Server.Service.Connector | Where-Object { $_.protocol -eq "HTTP/1.1" }
$httpConnector.SetAttribute("port", "5500")
$httpConnector.SetAttribute("address", "127.0.0.1")
$httpConnector.SetAttribute("URIEncoding", "UTF-8")
$serverXml.Save($serverXmlPath)

Copy-Item ".\Backend\target\enjoytrip.war" "$env:CATALINA_BASE\webapps\enjoytrip.war" -Force
& "$env:CATALINA_HOME\bin\catalina.bat" version
& "$env:CATALINA_HOME\bin\catalina.bat" run
```

`version` 출력에서 Java 25, Tomcat 11, 지정한 `CATALINA_BASE`를 확인합니다. `run`은 현재 창에 로그를 출력하며, 종료할 때는 **Ctrl+C**를 누릅니다. 다른 창에서 테스트를 실행할 수 있습니다.

- CATALINA_HOME: `C:\dev\apache-tomcat-11` (실제 설치 경로)
- CATALINA_BASE: `<저장소>\Backend\.runtime\tomcat`
- 배포 파일: `<CATALINA_BASE>\webapps\enjoytrip.war`
- context path: `/enjoytrip`
- 접속: [관광 지도](http://127.0.0.1:5500/enjoytrip/pages/map.html), [자유게시판](http://127.0.0.1:5500/enjoytrip/pages/free-board.html), [마이페이지](http://127.0.0.1:5500/enjoytrip/pages/my-page.html)
- 로그: `<CATALINA_BASE>\logs`

별도 창으로 서버를 실행하려면 `run` 대신 `start`를 사용합니다. 그 경우 같은 환경 변수가 설정된 PowerShell에서 아래 명령으로 종료합니다.

```powershell
& "$env:CATALINA_HOME\bin\catalina.bat" stop
```

소스 수정 후에는 **서버 종료 → WAR 재빌드 → WAR 복사 → 서버 실행** 순서로 다시 배포합니다. Python 정적 서버나 STS 서버가 5500을 점유하고 있으면 먼저 종료합니다. Python 정적 서버는 Servlet/JSP를 실행하지 못하므로 회원·게시판 연동은 위 Tomcat 주소에서 확인합니다. 저장소의 `Backend/scripts/tomcat.sh`는 macOS용이며 Windows에서는 위 `.bat` 명령을 사용합니다.

## API 요약

모든 경로 앞에 `/enjoytrip/api`를 붙입니다. 요청·응답은 UTF-8 JSON이고 삭제·로그아웃 성공은 빈 204 응답입니다.

| Method | 경로 | 기능 |
| --- | --- | --- |
| POST | /members/register | 가입 |
| POST | /auth/login | 로그인 |
| POST | /auth/logout | 로그아웃 |
| GET | /members/me | 내 정보·로그인 상태 |
| PUT | /members/me | 이름 수정 |
| DELETE | /members/me | 탈퇴·글 삭제 |
| GET | /posts?page=1&type=all&keyword= | 검색·페이징 |
| GET | /posts/{id} | 상세 |
| POST | /posts | 등록 |
| PUT | /posts/{id} | 수정 |
| DELETE | /posts/{id} | 삭제 |

Notion의 회원가입 표와 상세 경로가 달랐던 부분은 표 기준 `/members/register`로 구현했습니다. 별도 가입 별칭 API는 추가하지 않습니다.

직접 HTTP 클라이언트를 사용할 때 변경 요청에는 `X-Requested-With: EnjoyTrip`을 지정합니다. 본문이 있으면 `Content-Type: application/json`도 필요합니다. Origin이 있으면 같은 origin이어야 하며, 브라우저의 cross-site 요청은 거절합니다. 앱은 같은 origin의 JSESSIONID 쿠키를 전송합니다. 알 수 없는 JSON 필드는 400이고, 클라이언트가 작성자나 권한을 지정할 수 없습니다.

## Windows에서 검증

JDK·Maven 환경 변수를 설정한 PowerShell에서 저장소 루트를 기준으로 실행합니다. API·브라우저 검사는 Tomcat이 실행 중이어야 합니다.

```powershell
Push-Location .\Backend
mvn test
mvn clean package
Pop-Location

# Node.js 설치 시: PowerShell에서 테스트 파일 경로를 배열로 전달합니다.
$testFiles = Get-ChildItem .\Frontend\tests\*.test.js | ForEach-Object { $_.FullName }
node --test $testFiles

# Python 3와 Windows Python Launcher 설치 시
py -3 .\Backend\scripts\check_api.py
```

`py`가 없다면 Python 3의 `python` 명령으로 바꿔 실행합니다. `check_api.py`는 11개 API의 한글 왕복, 세션 ID 갱신/쿠키, 중복 가입, 검증 오류, 작성자 권한, 정렬/검색/페이징, 이름 반영, 탈퇴 연계와 다른 세션 무효화를 검증합니다. 고유한 테스트 회원을 만들고 종료 시 정리합니다. 기본 검사 주소는 `http://127.0.0.1:5500/enjoytrip`입니다.

Chrome과 Node.js/npm이 설치되어 있으면 선택적으로 브라우저 검사도 실행할 수 있습니다. Playwright는 임시 폴더에 설치하고 Windows Chrome 경로를 명시합니다.

```powershell
$browserTools = Join-Path $env:TEMP "enjoytrip-browser-tools"
npm install --prefix "$browserTools" playwright
$env:NODE_PATH = Join-Path $browserTools "node_modules"
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:ENJOYTRIP_BASE_URL = "http://127.0.0.1:5500/enjoytrip"
node .\Frontend\tests\browser-smoke.cjs
```

Chrome 설치 위치가 다르면 `CHROME_PATH`를 실제 `chrome.exe` 경로로 수정합니다. 스크립트 내부 기본값은 macOS 경로이므로 Windows에서는 이 변수를 지정해야 합니다.

브라우저 검사는 회원가입·로그인·새로고침 세션·글 작성/수정/삭제·다른 브라우저 조회·검색/페이징·이름 변경·로그아웃·탈퇴, 작성 중 세션 만료 후 로그인 복구, 오류 후 재시도, 모달 Escape/포커스 복원을 확인합니다. 1440/820/390px 캡처는 `Backend\.runtime\screenshots`에 저장됩니다. 지도 API 키를 비운 상황에서도 회원 모달이 열리는지 별도로 확인합니다. 실제 관광 API 결과는 키와 허용 origin 및 외부 서비스 상태에 따라 달라집니다.

## Windows STS 설정

1. `File → Import → Maven → Existing Maven Projects`에서 `Backend` 폴더를 선택합니다.
2. `Window → Preferences → Java → Installed JREs`에 Windows의 JDK 25 설치 폴더를 추가하고, 프로젝트 JRE도 JDK 25로 지정합니다.
3. 프로젝트에서 `Maven → Update Project`를 실행합니다.
4. `Server → Runtime Environments`에 설치한 Apache Tomcat 11을 추가하고 JRE를 JDK 25로 지정합니다.
5. STS에서 직접 배포한다면 Servers 뷰에서 HTTP 포트 **5500**, context path **`/enjoytrip`**을 확인하고 `http://127.0.0.1:5500/enjoytrip/pages/map.html`로 접속합니다. 위 PowerShell Tomcat과 동시에 같은 포트로 실행하지 않습니다.

현재 Eclipse 메타데이터는 **Java 25 / Dynamic Web Module 6.0**이고, `pom.xml`과 `web.xml`은 **Servlet 6.1**을 대상으로 합니다. STS/WTP가 Web Facet 6.1을 지원하면 Project Facets도 6.1로 맞춥니다. 지원하지 않으면 관련 도구를 업데이트하거나, 위 Maven WAR + Tomcat 11 배포 절차로 실행합니다. Servlet 의존성을 6.0 또는 `javax.servlet`로 바꾸지 않습니다.

Maven compiler 3.15.0(release 25), WAR 3.5.1, Servlet 6.1.0 provided, JSTL API 3.0.2 + 구현 3.0.1을 사용합니다. STS 서버는 자체 `CATALINA_BASE`를 사용하므로 위 PowerShell 설정과 별개입니다. Maven이 `Frontend`를 WAR에 포함하므로, STS 직접 배포에서 프론트 리소스가 누락되면 빌드한 WAR를 위 절차로 배포합니다.

## 기존 검증 결과

아래 결과는 macOS의 JDK 25 / Tomcat 11.0.27 / Chrome에서 확인한 기록입니다. Windows 실행 명령은 공식 문서와 프로젝트 설정을 기준으로 작성했으며 Windows 실환경 실행은 아직 검증하지 않았습니다.

- JDK 25의 Maven 테스트 8개와 clean package 통과
- 프론트엔드 node:test 75개 통과
- Tomcat 11.0.27 실제 HTTP 계약 검사 62건 통과
- Chrome 회원/게시판 E2E와 1440/820/390px 레이아웃·키보드 모달 검사 통과
- 최종 WAR의 프론트 소스 일치, JSTL 포함 및 Servlet/JSP API provided 확인
- 2026-10-30 Computer Use로 실제 Chrome에서 카카오 등록 origin인 `http://127.0.0.1:5500`으로 지도 실동작을 검증했습니다. 이전 8081/localhost:8080의 SDK 401 오류는 등록 origin 불일치로 재현됐고, 127.0.0.1:5500에서는 정상 로드됩니다. 키 변경은 하지 않았습니다.
- 서울특별시 → 종로구 → 역사관광 검색에서 66곳 조회, 목록·지도 마커 표시, 경복궁 상세 소개·사진·방문 정보·기상청 날씨 표시를 확인했습니다.
- 별도의 `Computer Use 검증용 여행`(2026-11-01)을 생성하고 경복궁·경희궁 2곳 추가, 직선거리 기준 최단 순서 적용, 카카오내비 자동차 경로 지도 표시, 새로고침 후 2개 장소 저장 유지를 확인했습니다. 기존 여행 계획은 보존했습니다.
- 현재 위치 권한을 사용하는 내 주변 검색은 이번 검증에 포함하지 않았습니다.
