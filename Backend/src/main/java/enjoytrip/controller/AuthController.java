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
        if (!"/login".equals(path) && !"/logout".equals(path)) { notFound(); return; }
        if (!"POST".equals(req.getMethod())) { methodNotAllowed(res, "POST"); return; }
        if ("/login".equals(path)) {
            MemberDto member = service.login(read(req, MemberDto.LoginRequest.class));
            HttpSession session = req.getSession();
            req.changeSessionId();
            session.setAttribute("memberId", member.id());
            success(res, 200, member);
        } else {
            HttpSession session = req.getSession(false);
            if (session != null) session.invalidate();
            res.setStatus(204);
        }
    }
}
