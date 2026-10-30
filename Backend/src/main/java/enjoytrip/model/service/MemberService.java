package enjoytrip.model.service;

import enjoytrip.model.api.MemberDto;

public interface MemberService {
    MemberDto register(MemberDto.SignupRequest request);
    MemberDto login(MemberDto.LoginRequest request);
    MemberDto profile(String id);
    MemberDto rename(String id, MemberDto.UpdateRequest request);
    void delete(String id);
}
