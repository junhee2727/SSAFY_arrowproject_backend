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
        var member = service.register(signup("  " + email.toUpperCase() + "  "));
        assertEquals(email, member.email());
        assertEquals(member.id(), service.login(new MemberDto.LoginRequest(email, " password123 ")).member().id());
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
        var member = service.register(signup(email()));
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

    private MemberDto.PasswordResetRequest reset(String email, String code, String password) {
        return new MemberDto.PasswordResetRequest(email, code, password, password);
    }

    @Test void recoveryCodeIsPrivateAndRotatesWhileExistingSessionsAndPasswordExpire() {
        var member = service.register(signup(email()));
        assertTrue(member.recoveryCode().matches("[A-Za-z0-9_-]{43}"));
        var stored = enjoytrip.model.dao.InMemoryMemberDao.getInstance().findById(member.id());
        assertNotEquals(member.recoveryCode(), stored.getRecoveryCodeHash());
        assertFalse(member.toString().contains(member.recoveryCode()));
        var login = service.login(new MemberDto.LoginRequest(member.email(), " password123 "));
        service.rename(member.id(), new MemberDto.UpdateRequest("변경이름"));
        var changed = service.resetPassword(reset(" " + member.email().toUpperCase() + " ", member.recoveryCode(), " newPassword123 "));
        assertEquals(member.id(), changed.id());
        assertEquals("변경이름", changed.name());
        assertNotEquals(member.recoveryCode(), changed.recoveryCode());
        assertEquals(401, assertThrows(ApiException.class, () -> service.authenticatedProfile(member.id(), login.credentialVersion())).status());
        assertEquals(401, assertThrows(ApiException.class, () -> service.login(new MemberDto.LoginRequest(member.email(), " password123 "))).status());
        var nextLogin = service.login(new MemberDto.LoginRequest(member.email(), " newPassword123 "));
        assertEquals(member.id(), service.authenticatedProfile(member.id(), nextLogin.credentialVersion()).id());
        assertEquals("INVALID_RECOVERY", assertThrows(ApiException.class, () -> service.resetPassword(reset(member.email(), member.recoveryCode(), "anotherPassword"))).code());
        assertNotNull(service.resetPassword(reset(member.email(), changed.recoveryCode(), "anotherPassword")));
        service.delete(member.id());
    }

    @Test void invalidRecoveryCannotChangeCredentialsAndDoesNotRevealAccountExistence() {
        var member = service.register(signup(email()));
        var wrongCode = reset(member.email(), "wrong", "newPassword123");
        var wrongEmail = reset(email(), member.recoveryCode(), "newPassword123");
        var first = assertThrows(ApiException.class, () -> service.resetPassword(wrongCode));
        var second = assertThrows(ApiException.class, () -> service.resetPassword(wrongEmail));
        assertEquals(first.code(), second.code()); assertEquals(first.getMessage(), second.getMessage());
        assertThrows(ApiException.class, () -> service.resetPassword(reset(member.email(), member.recoveryCode(), "short")));
        assertThrows(ApiException.class, () -> service.resetPassword(new MemberDto.PasswordResetRequest(member.email(), member.recoveryCode(), "newPassword123", "different")));
        assertEquals(member.id(), service.login(new MemberDto.LoginRequest(member.email(), " password123 ")).member().id());
        assertFalse(wrongEmail.toString().contains(member.recoveryCode()));
        service.delete(member.id());
        assertEquals("INVALID_RECOVERY", assertThrows(ApiException.class, () -> service.resetPassword(reset(member.email(), member.recoveryCode(), "newPassword123"))).code());
    }

    @Test void recoveryDoesNotExpireAnotherMembersSession() {
        var owner = service.register(signup(email()));
        var other = service.register(signup(email()));
        var otherLogin = service.login(new MemberDto.LoginRequest(other.email(), " password123 "));
        service.resetPassword(reset(owner.email(), owner.recoveryCode(), "newPassword123"));
        assertEquals(other.id(), service.authenticatedProfile(other.id(), otherLogin.credentialVersion()).id());
        service.delete(owner.id()); service.delete(other.id());
    }

    @Test void concurrentRecoveryConsumesTheCodeOnlyOnce() throws Exception {
        var member = service.register(signup(email()));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var attempts = executor.invokeAll(IntStream.range(0, 2).<java.util.concurrent.Callable<Boolean>>mapToObj(i -> () -> {
                try { service.resetPassword(reset(member.email(), member.recoveryCode(), "newPassword123")); return true; }
                catch (ApiException e) { assertEquals("INVALID_RECOVERY", e.code()); return false; }
            }).toList());
            int successes = 0;
            for (var attempt : attempts) if (attempt.get()) successes++;
            assertEquals(1, successes);
        }
        assertEquals(member.id(), service.login(new MemberDto.LoginRequest(member.email(), "newPassword123")).member().id());
        service.delete(member.id());
    }
}
