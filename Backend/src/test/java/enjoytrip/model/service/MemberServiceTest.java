package enjoytrip.model.service;

import enjoytrip.model.api.MemberDto;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class MemberServiceTest {
    private final MemberService service = BasicMemberService.getService();
    private String email() { return UUID.randomUUID() + "@example.com"; }
    private MemberDto.SignupRequest signup(String email) {
        return new MemberDto.SignupRequest("한글여행자", email, " password123 ", " password123 ", true);
    }
    @Test void normalizesEmailAndPreservesPasswordWhitespace() {
        String email = email();
        MemberDto member = service.register(signup("  " + email.toUpperCase() + "  "));
        assertEquals(email, member.email());
        assertEquals(member.id(), service.login(new MemberDto.LoginRequest(email, " password123 ")).id());
        assertEquals(401, assertThrows(ApiException.class,
                () -> service.login(new MemberDto.LoginRequest(email, "password123"))).status());
        assertEquals(409, assertThrows(ApiException.class, () -> service.register(signup(email))).status());
    }
    @Test void validatesConsentConfirmationNameAndEmail() {
        assertThrows(ApiException.class, () -> service.register(new MemberDto.SignupRequest("가", email(), "password123", "password123", true)));
        assertThrows(ApiException.class, () -> service.register(new MemberDto.SignupRequest("여행", "bad", "password123", "password123", true)));
        assertThrows(ApiException.class, () -> service.register(new MemberDto.SignupRequest("여행", email(), "password123", "different", true)));
        assertThrows(ApiException.class, () -> service.register(new MemberDto.SignupRequest("여행", email(), "password123", "password123", null)));
    }
    @Test void renameAndDeleteAffectSubsequentAuthentication() {
        MemberDto member = service.register(signup(email()));
        assertEquals("새이름", service.rename(member.id(), new MemberDto.UpdateRequest(" 새이름 ")).name());
        service.delete(member.id());
        assertEquals(401, assertThrows(ApiException.class, () -> service.profile(member.id())).status());
        assertEquals(401, assertThrows(ApiException.class,
                () -> service.login(new MemberDto.LoginRequest(member.email(), " password123 "))).status());
    }
    @Test void concurrentDuplicateSignupsCreateOnlyOneAccount() throws Exception {
        String email = email();
        try (var executor = Executors.newFixedThreadPool(4)) {
            var results = executor.invokeAll(IntStream.range(0, 4).<java.util.concurrent.Callable<Boolean>>mapToObj(i -> () -> {
                try { service.register(signup(email)); return true; }
                catch (ApiException e) { assertEquals(409, e.status()); return false; }
            }).toList());
            int successes = 0;
            for (var result : results) if (result.get()) successes++;
            assertEquals(1, successes);
        }
    }
}
