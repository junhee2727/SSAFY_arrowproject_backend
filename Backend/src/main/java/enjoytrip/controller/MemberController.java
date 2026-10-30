package enjoytrip.controller;

import enjoytrip.model.api.MemberDto;
import enjoytrip.model.service.BasicMemberService;
import enjoytrip.model.service.MemberService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet("/api/members/*")
public final class MemberController extends ApiController {
    private final MemberService service = BasicMemberService.getService();
    protected void handle(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if ("/register".equals(path)) {
            if (!"POST".equals(req.getMethod())) { methodNotAllowed(res, "POST"); return; }
            success(res, 201, service.register(read(req, MemberDto.SignupRequest.class)));
        } else if ("/me".equals(path)) {
            String id = userId(req);
            switch (req.getMethod()) {
                case "GET" -> success(res, 200, service.profile(id));
                case "PUT" -> success(res, 200, service.rename(id, read(req, MemberDto.UpdateRequest.class)));
                case "DELETE" -> {
                    service.delete(id);
                    req.getSession(false).invalidate();
                    res.setStatus(204);
                }
                default -> methodNotAllowed(res, "GET, PUT, DELETE");
            }
        } else notFound();
    }
}
