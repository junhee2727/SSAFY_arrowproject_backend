package enjoytrip.controller;

import enjoytrip.model.api.BoardDto;
import enjoytrip.model.service.ApiException;
import enjoytrip.model.service.BasicBoardService;
import enjoytrip.model.service.BoardService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet("/api/posts/*")
public final class BoardController extends ApiController {
    private final BoardService service = BasicBoardService.getService();
    protected void handle(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (path == null || "/".equals(path)) {
            switch (req.getMethod()) {
                case "GET" -> success(res, 200, service.search(req.getParameter("page"), req.getParameter("type"), req.getParameter("keyword")));
                case "POST" -> success(res, 201, service.create(userId(req), read(req, BoardDto.SaveRequest.class)));
                default -> methodNotAllowed(res, "GET, POST");
            }
        } else if (path.substring(1).contains("/")) notFound();
        else {
            String id = path.substring(1);
            switch (req.getMethod()) {
                case "GET" -> {
                    String viewerId = null;
                    try { viewerId = userId(req); } catch (ApiException e) { if (e.status() != 401) throw e; }
                    success(res, 200, service.detail(id, viewerId));
                }
                case "PUT" -> success(res, 200, service.update(id, userId(req), read(req, BoardDto.SaveRequest.class)));
                case "DELETE" -> { service.delete(id, userId(req)); res.setStatus(204); }
                default -> methodNotAllowed(res, "GET, PUT, DELETE");
            }
        }
    }
}
