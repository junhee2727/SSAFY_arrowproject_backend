package enjoytrip.controller;

import enjoytrip.model.api.MemberDto;
import enjoytrip.model.service.BasicMemberService;
import enjoytrip.model.service.MemberService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

@WebServlet("/api/auth/*")
public final class AuthController extends ApiController {
    private final MemberService service = BasicMemberService.getService();
    protected void handle(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (!"/login".equals(path) && !"/logout".equals(path) && !"/password-reset".equals(path)) { notFound(); return; }
        if (!"POST".equals(req.getMethod())) { methodNotAllowed(res, "POST"); return; }
        if ("/login".equals(path)) {
            MemberService.Authentication authentication = service.login(read(req, MemberDto.LoginRequest.class));
            HttpSession session = req.getSession();
            req.changeSessionId();
            session.setAttribute("memberId", authentication.member().id());
            session.setAttribute("credentialVersion", authentication.credentialVersion());
            success(res, 200, authentication.member());
        } else if ("/password-reset".equals(path)) {
            MemberDto.RecoveryResponse result = service.resetPassword(read(req, MemberDto.PasswordResetRequest.class));
            HttpSession session = req.getSession(false);
            if (session != null && result.id().equals(session.getAttribute("memberId"))) session.invalidate();
            success(res, 200, result);
        } else {
            HttpSession session = req.getSession(false);
            if (session != null) session.invalidate();
            res.setStatus(204);
        }
    }
}
