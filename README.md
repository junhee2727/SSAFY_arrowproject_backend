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
- 참고 예제: `/Users/junheelee/Downloads/BE_06_Project_sol`
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

## macOS 빌드

Java 25, Maven, Tomcat 11이 필요합니다. 현재 확인한 설치는 Homebrew Tomcat 11.0.27입니다.

```sh
java -version
mvn -version
/usr/libexec/java_home -V
export JAVA_HOME="$(/usr/libexec/java_home -v 25)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
mvn -version
```

두 Java 버전이 모두 25인지 확인합니다. Maven 기본 JDK가 27 등 다른 버전이어도 compiler release를 내리지 않고 JAVA_HOME을 지정합니다.

관광·지도 키 설정이 없으면 저장소 루트에서 아래 파일을 한 번 복사하고 브라우저용 키를 입력합니다. 회원·게시판은 이 키가 없어도 동작합니다.

```sh
cp Frontend/config.env.example Frontend/config.env
```

config.env는 브라우저 접근이 가능한 공개 API 키 전용 파일이며 Git에 커밋하지 않습니다. 로컬 WAR에는 현재 파일이 포함되므로 외부에 WAR를 공유할 때도 키 정책을 확인합니다.

```sh
cd Backend
mvn test
mvn clean package
```

결과는 `Backend/target/enjoytrip.war`입니다. Maven WAR 설정이 Frontend의 페이지·JS·CSS·리소스를 같은 웹앱에 포함합니다. 프론트엔드 별도 빌드/의존성 설치는 필요하지 않습니다.

## 실제 로컬 Tomcat 배포

저장소 루트에서 실행합니다.

```sh
Backend/scripts/tomcat.sh version
Backend/scripts/tomcat.sh start
```

- CATALINA_HOME: `$(brew --prefix tomcat)/libexec` (이 Mac: `/opt/homebrew/opt/tomcat/libexec`)
- CATALINA_BASE: `/Users/junheelee/Work/SSAFY_arrowproject_backend/Backend/.runtime/tomcat`
- 배포: `.runtime/tomcat/webapps/enjoytrip.war`
- context path: `/enjoytrip`
- HTTP 접속: **127.0.0.1:5500**, 종료 포트: **127.0.0.1:5501**
- 기본 Java: `/usr/libexec/java_home -v 25`로 발견한 JDK
- 로그: `Backend/.runtime/tomcat/logs/`

접속: [관광 지도](http://127.0.0.1:5500/enjoytrip/pages/map.html), [자유게시판](http://127.0.0.1:5500/enjoytrip/pages/free-board.html), [마이페이지](http://127.0.0.1:5500/enjoytrip/pages/my-page.html)

이번 작업의 실제 실행 검증은 `run` 모드로 수행했습니다. 포그라운드 로그를 보려면 `start` 대신 `run`을 사용하고 Control+C로 종료합니다. `ENJOYTRIP_PORT`로 HTTP 포트를 바꿀 수 있으며 다음 번호를 종료 포트로 사용합니다. `CATALINA_HOME`, `ENJOYTRIP_JAVA_HOME`으로 설치 경로를 명시할 수도 있습니다. 기존 Homebrew 서비스/STS Tomcat과 별도의 CATALINA_BASE를 사용합니다. 카카오에 등록된 사이트 주소는 `http://127.0.0.1:5500`이므로 브라우저도 이 호스트와 포트를 사용합니다. Python 정적 서버나 다른 Tomcat이 5500을 사용 중이면 먼저 해당 서버를 종료해 포트 충돌을 해결해야 합니다.

```sh
Backend/scripts/tomcat.sh stop
```

소스 수정 후에는 `stop → mvn clean package → start` 순서로 다시 배포합니다. Python 5500 정적 서버는 Servlet/JSP를 실행하지 못하므로 회원·게시판 연동 확인은 위 Tomcat 주소에서 진행합니다.

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

## 검증

```sh
cd Backend
mvn test
mvn clean package
cd ..
node --test Frontend/tests/*.test.js
python3 Backend/scripts/check_api.py
```

`check_api.py`는 실행 중인 Tomcat에서 11개 API의 한글 왕복, 세션 ID 갱신/쿠키, 중복 가입, 검증 오류, 작성자 권한, 정렬/검색/페이징, 이름 반영, 탈퇴 연계와 다른 세션 무효화를 검증합니다. 고유한 테스트 회원을 만들고 종료 시 정리합니다.

Playwright와 Chrome이 있는 환경에서는 브라우저 검사도 실행할 수 있습니다.

```sh
node Frontend/tests/browser-smoke.cjs
```

Playwright를 공용 위치에 설치했다면 NODE_PATH를 해당 node_modules로 지정합니다. CHROME_PATH와 ENJOYTRIP_BASE_URL을 바꿔 실행 환경을 조정할 수 있습니다. 기본 Chrome 경로는 macOS Google Chrome이며, 기본 검사 주소는 127.0.0.1:5500/enjoytrip입니다.

브라우저 검사는 회원가입·로그인·새로고침 세션·글 작성/수정/삭제·다른 브라우저 조회·검색/페이징·이름 변경·로그아웃·탈퇴, 작성 중 세션 만료 후 로그인 복구, 오류 후 재시도, 모달 Escape/포커스 복원을 확인합니다. 1440/820/390px 캡처는 `Backend/.runtime/screenshots/`에 저장됩니다. 지도 API 키를 비운 상황에서도 회원 모달은 열리는지 별도로 확인합니다. 실제 관광 API 결과는 키와 허용 origin 및 외부 서비스 상태에 따라 달라집니다.

## STS 설정

기존 메타데이터의 Java 1.8 / Dynamic Web Module 2.5를 **Java 25 / Web 6.1**로 정렬했습니다. Maven compiler 3.15.0(release 25), WAR 3.5.1, Servlet 6.1.0 provided, JSTL API 3.0.2 + 구현 3.0.1을 사용합니다.

STS에서 Maven Update Project를 실행한 뒤 Installed JREs는 JDK 25, Target Runtime은 설치된 Apache Tomcat 11을 선택합니다. STS 자체 서버를 쓰면 그 서버의 CATALINA_BASE/포트는 위 독립 실행 설정과 별개입니다. 이 문서의 자동 검증은 명시한 독립 CATALINA_BASE에 배포한 WAR를 기준으로 수행합니다.

## 검증 결과

- JDK 25의 Maven 테스트 8개와 clean package 통과
- 프론트엔드 node:test 75개 통과
- Tomcat 11.0.27 실제 HTTP 계약 검사 62건 통과
- Chrome 회원/게시판 E2E와 1440/820/390px 레이아웃·키보드 모달 검사 통과
- 최종 WAR의 프론트 소스 일치, JSTL 포함 및 Servlet/JSP API provided 확인
- 2026-10-30 Computer Use로 실제 Chrome에서 카카오 등록 origin인 `http://127.0.0.1:5500`으로 지도 실동작을 검증했습니다. 이전 8081/localhost:8080의 SDK 401 오류는 등록 origin 불일치로 재현됐고, 127.0.0.1:5500에서는 정상 로드됩니다. 키 변경은 하지 않았습니다.
- 서울특별시 → 종로구 → 역사관광 검색에서 66곳 조회, 목록·지도 마커 표시, 경복궁 상세 소개·사진·방문 정보·기상청 날씨 표시를 확인했습니다.
- 별도의 `Computer Use 검증용 여행`(2026-11-01)을 생성하고 경복궁·경희궁 2곳 추가, 직선거리 기준 최단 순서 적용, 카카오내비 자동차 경로 지도 표시, 새로고침 후 2개 장소 저장 유지를 확인했습니다. 기존 여행 계획은 보존했습니다.
- 현재 위치 권한을 사용하는 내 주변 검색은 이번 검증에 포함하지 않았습니다.
