package enjoytrip.controller;

import enjoytrip.model.api.CommonDto;
import enjoytrip.model.service.ApiException;
import enjoytrip.model.service.BasicMemberService;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.json.JsonMapper;

public abstract class ApiController extends HttpServlet {
    private static final int MAX_BODY = 65_536;
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS).build();

    @Override
    protected final void service(HttpServletRequest req, HttpServletResponse res) throws IOException {
        req.setCharacterEncoding("UTF-8");
        res.setCharacterEncoding("UTF-8");
        res.setContentType("application/json;charset=UTF-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        try {
            if (!Set.of("GET", "HEAD", "OPTIONS").contains(req.getMethod())) checkOrigin(req);
            handle(req, res);
        } catch (ApiException e) {
            error(res, e.status(), e.code(), e.getMessage());
        } catch (JacksonException e) {
            error(res, 400, "VALIDATION_ERROR", "올바른 JSON 필드를 입력해주세요.");
        } catch (Exception e) {
            getServletContext().log("API request failed: " + req.getMethod() + " " + req.getServletPath(), e);
            error(res, 500, "INTERNAL_ERROR", "요청 처리 중 문제가 발생했습니다.");
        }
    }
    protected abstract void handle(HttpServletRequest req, HttpServletResponse res) throws IOException;
    private void checkOrigin(HttpServletRequest req) {
        if (!"EnjoyTrip".equals(req.getHeader("X-Requested-With"))) forbidden();
        String origin = req.getHeader("Origin");
        if (origin != null) {
            try {
                URI uri = URI.create(origin);
                int port = uri.getPort() < 0 ? ("https".equals(uri.getScheme()) ? 443 : 80) : uri.getPort();
                if (!req.getScheme().equals(uri.getScheme()) || !req.getServerName().equalsIgnoreCase(uri.getHost()) || req.getServerPort() != port) forbidden();
            } catch (IllegalArgumentException e) { forbidden(); }
        }
        if ("cross-site".equals(req.getHeader("Sec-Fetch-Site"))) forbidden();
    }
    private void forbidden() { throw new ApiException(403, "FORBIDDEN", "허용되지 않은 요청입니다."); }
    protected <T> T read(HttpServletRequest req, Class<T> type) throws IOException {
        String contentType = req.getContentType();
        if (contentType == null || !contentType.split(";", 2)[0].trim().equalsIgnoreCase("application/json")) {
            throw ApiException.validation("Content-Type은 application/json이어야 합니다.");
        }
        byte[] bytes = req.getInputStream().readNBytes(MAX_BODY + 1);
        if (bytes.length > MAX_BODY) throw new ApiException(413, "PAYLOAD_TOO_LARGE", "요청이 너무 큽니다.");
        T value = JSON.readValue(new String(bytes, StandardCharsets.UTF_8), type);
        if (value == null) throw ApiException.validation("요청 본문을 입력해주세요.");
        return value;
    }
    protected String userId(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        String id = session == null ? null : (String) session.getAttribute("memberId");
        try { return BasicMemberService.getService().profile(id).id(); }
        catch (ApiException e) {
            if (session != null) session.invalidate();
            throw e;
        }
    }
    protected void success(HttpServletResponse res, int status, Object data) throws IOException {
        res.setStatus(status);
        res.getWriter().write(JSON.writeValueAsString(new CommonDto.Response<>(data)));
    }
    private void error(HttpServletResponse res, int status, String code, String message) throws IOException {
        res.setStatus(status);
        res.getWriter().write(JSON.writeValueAsString(new CommonDto.ErrorResponse(new CommonDto.ErrorBody(code, message))));
    }
    protected void methodNotAllowed(HttpServletResponse res, String allowed) {
        res.setHeader("Allow", allowed);
        throw new ApiException(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다.");
    }
    protected void notFound() { throw new ApiException(404, "NOT_FOUND", "요청한 API를 찾을 수 없습니다."); }
}
