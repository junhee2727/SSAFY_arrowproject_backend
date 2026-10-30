const FREE_POSTS_KEY = "travel_free_posts";
const NOTICES_KEY = "travel_notices";
const BOARD_SEED_KEY = "travel_board_seeded_v1";

const FREE_POST_SEEDS = [
  {
    id: "free-128",
    sequence: 128,
    category: "review",
    title: "제주 동쪽에서 보낸 느긋한 2박 3일",
    content: "이번 여행은 유명한 장소를 많이 둘러보기보다 제주 동쪽의 풍경을 천천히 즐기는 일정으로 다녀왔습니다.\n\n첫날에는 함덕 해변을 산책하고 근처에서 고기국수를 먹었습니다. 해가 질 무렵에는 김녕 해안도로를 따라 이동했는데 사람이 많지 않아 여유롭게 바다를 볼 수 있었습니다.\n\n추천 일정은 함덕 해변, 김녕 해안도로, 월정리 해변 순서입니다. 렌터카로 이동하면 약 40분 정도이고 중간중간 작은 카페에 들르기 좋았습니다.\n\n일정을 빽빽하게 채우지 않아도 충분히 즐거운 여행이었습니다. 제주 동쪽에서 조용히 쉬고 싶은 분들께 추천합니다.",
    authorId: "seed-sky-cloud",
    authorName: "하늘구름",
    createdAt: "2026-10-02T09:15:00+09:00",
    updatedAt: null,
    views: 74,
    images: [],
    comments: [
      { id: "comment-128-1", authorId: "seed-beginner", authorName: "여행초보", content: "저도 다음 달에 제주 동쪽으로 가는데 동선이 정말 도움이 됐어요. 추천 감사합니다!", createdAt: "2026-10-02T14:22:00+09:00" },
      { id: "comment-128-2", authorId: "seed-walker", authorName: "걷는사람", content: "섭지코지는 바람이 많이 부는군요. 겉옷 꼭 챙겨가야겠어요.", createdAt: "2026-10-02T15:08:00+09:00" },
    ],
  },
  {
    id: "free-127",
    sequence: 127,
    category: "question",
    title: "부산 당일치기 동선 추천 부탁드려요",
    content: "다음 주에 부산으로 당일치기 여행을 갑니다. 부산역에 오전 9시쯤 도착하고 저녁 8시 기차로 돌아올 예정이에요.\n\n해운대와 흰여울문화마을을 모두 보고 싶은데 하루에 다녀오기에 괜찮은 동선이 있을까요? 대중교통 기준으로 추천 부탁드립니다.",
    authorId: "seed-beginner",
    authorName: "여행초보",
    createdAt: "2026-10-02T08:30:00+09:00",
    updatedAt: null,
    views: 48,
    images: [],
    comments: [],
  },
  {
    id: "free-126",
    sequence: 126,
    category: "info",
    title: "단풍 시기에 가기 좋은 조용한 산책길",
    content: "유명 관광지보다 한적하게 걸을 수 있는 단풍길을 정리해봤습니다. 아침 일찍 방문하면 더욱 여유롭게 풍경을 감상할 수 있어요.\n\n방문 전에는 각 지역의 단풍 절정 시기와 주차 정보를 꼭 확인해주세요.",
    authorId: "seed-walker",
    authorName: "걷는사람",
    createdAt: "2026-10-01T16:20:00+09:00",
    updatedAt: null,
    views: 193,
    images: [],
    comments: [],
  },
  {
    id: "free-125",
    sequence: 125,
    category: "food",
    title: "강릉 여행에서 다시 가고 싶은 식당 세 곳",
    content: "강릉에서 직접 방문해본 식당 중 다시 가고 싶은 세 곳을 소개합니다. 메뉴와 대기 시간, 주변 주차 정보도 함께 정리했어요.",
    authorId: "seed-foodie",
    authorName: "맛있는여행",
    createdAt: "2026-10-01T11:10:00+09:00",
    updatedAt: null,
    views: 156,
    images: [],
    comments: [],
  },
  {
    id: "free-124",
    sequence: 124,
    category: "companion",
    title: "이번 주말 전주 한옥마을 함께 둘러보실 분",
    content: "이번 주 토요일 오후에 전주 한옥마을을 천천히 둘러볼 예정입니다. 사진 찍기와 카페 방문을 좋아하는 분이면 좋겠습니다.",
    authorId: "seed-weekend",
    authorName: "주말여행자",
    createdAt: "2026-09-30T18:40:00+09:00",
    updatedAt: null,
    views: 88,
    images: [],
    comments: [],
  },
  {
    id: "free-123",
    sequence: 123,
    category: "free",
    title: "여행 가기 전날이 가장 설레는 것 같아요",
    content: "짐을 챙기고 일정을 마지막으로 확인하는 시간이 여행만큼 즐거운 것 같아요. 여러분은 여행의 어느 순간이 가장 설레나요?",
    authorId: "seed-blue-sea",
    authorName: "푸른바다",
    createdAt: "2026-09-30T10:05:00+09:00",
    updatedAt: null,
    views: 201,
    images: [],
    comments: [],
  },
  {
    id: "free-122",
    sequence: 122,
    category: "question",
    title: "아이와 함께 가기 좋은 서울 근교 여행지",
    content: "초등학생 아이와 주말에 다녀올 수 있는 서울 근교 여행지를 찾고 있습니다. 체험 활동이 있거나 걷기 편한 곳이면 좋겠습니다.",
    authorId: "seed-family",
    authorName: "가족여행",
    createdAt: "2026-09-29T13:25:00+09:00",
    updatedAt: null,
    views: 117,
    images: [],
    comments: [],
  },
];

const NOTICE_SEEDS = [
  {
    id: "notice-12",
    sequence: 12,
    badge: "필독",
    pinned: true,
    title: "푸른 하늘 여행 서비스 이용 안내",
    content: "안녕하세요. 푸른 하늘 여행을 이용해주시는 모든 여행자 여러분께 감사드립니다.\n\n푸른 하늘 여행에서는 지역과 관광지를 선택해 전국의 다양한 관광지를 지도에서 찾아볼 수 있습니다. 검색 결과의 숫자 표시를 선택하면 지역이 확대되고, 개별 마커에 마우스를 올리면 장소 이름을 확인할 수 있습니다.\n\n더 정확한 주변 관광지 검색을 위해 브라우저의 위치 권한을 허용해주세요. 위치 권한을 허용하지 않아도 현재 지도 중심을 기준으로 검색할 수 있습니다.\n\n공지사항과 자유 게시판에서는 서비스 소식과 여행자들의 경험을 함께 확인할 수 있습니다. 게시판을 이용할 때에는 개인정보가 포함되지 않도록 주의해주세요.",
    authorName: "운영팀",
    createdAt: "2026-10-02T08:00:00+09:00",
    views: 328,
  },
  {
    id: "notice-11",
    sequence: 11,
    badge: "공지",
    pinned: true,
    title: "관광지 검색 서비스 점검 안내",
    content: "더 안정적인 관광지 검색 서비스를 제공하기 위해 시스템 점검을 진행합니다.\n\n점검 시간에는 지도 검색 결과가 일시적으로 느리게 표시될 수 있습니다. 이용에 불편을 드려 죄송합니다.",
    authorName: "운영팀",
    createdAt: "2026-09-30T09:00:00+09:00",
    views: 214,
  },
  {
    id: "notice-10",
    sequence: 10,
    badge: null,
    pinned: false,
    title: "가을 여행지 추천 콘텐츠가 추가되었습니다",
    content: "선선한 날씨에 방문하기 좋은 가을 여행지 추천 콘텐츠가 추가되었습니다. 지도에서 지역을 선택해 새로운 여행지를 만나보세요.",
    authorName: "운영팀",
    createdAt: "2026-09-27T10:00:00+09:00",
    views: 186,
  },
  {
    id: "notice-9",
    sequence: 9,
    badge: null,
    pinned: false,
    title: "지도 검색 결과 표시 방식 변경 안내",
    content: "관광지 검색 결과를 더 쉽게 확인할 수 있도록 지도 마커와 목록의 표시 방식을 개선했습니다.",
    authorName: "운영팀",
    createdAt: "2026-09-20T10:00:00+09:00",
    views: 152,
  },
  {
    id: "notice-8",
    sequence: 8,
    badge: null,
    pinned: false,
    title: "개인정보 처리방침 개정 안내",
    content: "서비스 운영 정책 변경에 따라 개인정보 처리방침이 개정되었습니다. 회원 여러분께서는 변경 내용을 확인해주세요.",
    authorName: "운영팀",
    createdAt: "2026-09-12T10:00:00+09:00",
    views: 98,
  },
  {
    id: "notice-7",
    sequence: 7,
    badge: null,
    pinned: false,
    title: "여행 후기 작성 가이드를 확인해주세요",
    content: "자유 게시판에 여행 후기를 작성할 때 위치, 이동 방법, 방문 시간과 같은 정보를 함께 적으면 다른 여행자에게 큰 도움이 됩니다.",
    authorName: "운영팀",
    createdAt: "2026-09-05T10:00:00+09:00",
    views: 121,
  },
  {
    id: "notice-6",
    sequence: 6,
    badge: null,
    pinned: false,
    title: "푸른 하늘 여행 베타 서비스 오픈",
    content: "푸른 하늘 여행 베타 서비스를 시작합니다. 관광지 검색과 자유 게시판을 이용하고 소중한 의견을 남겨주세요.",
    authorName: "운영팀",
    createdAt: "2026-08-28T10:00:00+09:00",
    views: 407,
  },
  {
    id: "notice-5",
    sequence: 5,
    badge: null,
    pinned: false,
    title: "모바일 화면 개선 안내",
    content: "작은 화면에서도 관광지와 게시판을 편리하게 확인할 수 있도록 모바일 화면을 개선했습니다.",
    authorName: "운영팀",
    createdAt: "2026-08-20T10:00:00+09:00",
    views: 83,
  },
  {
    id: "notice-4",
    sequence: 4,
    badge: null,
    pinned: false,
    title: "서비스 이용 의견을 들려주세요",
    content: "푸른 하늘 여행을 이용하며 느낀 불편한 점이나 새로운 아이디어가 있다면 자유 게시판에 남겨주세요.",
    authorName: "운영팀",
    createdAt: "2026-08-12T10:00:00+09:00",
    views: 75,
  },
  {
    id: "notice-3",
    sequence: 3,
    badge: null,
    pinned: false,
    title: "게시판 이용 수칙 안내",
    content: "서로를 존중하는 표현을 사용해주세요. 개인정보, 광고성 내용, 불쾌감을 주는 게시물은 안내 없이 삭제될 수 있습니다.",
    authorName: "운영팀",
    createdAt: "2026-08-05T10:00:00+09:00",
    views: 139,
  },
  {
    id: "notice-2",
    sequence: 2,
    badge: null,
    pinned: false,
    title: "지원 브라우저 안내",
    content: "원활한 서비스 이용을 위해 최신 버전의 Chrome, Edge, Safari 브라우저 사용을 권장합니다.",
    authorName: "운영팀",
    createdAt: "2026-07-29T10:00:00+09:00",
    views: 66,
  },
  {
    id: "notice-1",
    sequence: 1,
    badge: null,
    pinned: false,
    title: "푸른 하늘 여행에 오신 것을 환영합니다",
    content: "푸른 하늘 여행에 오신 것을 환영합니다. 새로운 여행지를 발견하고 여행자들과 유용한 정보를 나눠보세요.",
    authorName: "운영팀",
    createdAt: "2026-07-20T10:00:00+09:00",
    views: 254,
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readList(key) {
  const savedValue = localStorage.getItem(key);

  if (!savedValue) return [];

  try {
    const parsedValue = JSON.parse(savedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function createId(prefix) {
  const randomId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function sortNewestFirst(items) {
  return [...items].sort((first, second) => {
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

export function initializeBoardStorage() {
  if (localStorage.getItem(BOARD_SEED_KEY)) return;

  if (readList(FREE_POSTS_KEY).length === 0) {
    saveList(FREE_POSTS_KEY, clone(FREE_POST_SEEDS));
  }

  if (readList(NOTICES_KEY).length === 0) {
    saveList(NOTICES_KEY, clone(NOTICE_SEEDS));
  }

  localStorage.setItem(BOARD_SEED_KEY, "true");
}

export function getFreePosts() {
  initializeBoardStorage();
  return sortNewestFirst(readList(FREE_POSTS_KEY));
}

export function getFreePost(postId) {
  return getFreePosts().find((post) => post.id === postId) ?? null;
}

export function createFreePost({ category, title, content, images, user }) {
  const posts = getFreePosts();
  const nextSequence = Math.max(0, ...posts.map((post) => Number(post.sequence) || 0)) + 1;
  const now = new Date().toISOString();
  const post = {
    id: createId("free"),
    sequence: nextSequence,
    category,
    title: title.trim(),
    content: content.trim(),
    authorId: user.id,
    authorName: user.name,
    createdAt: now,
    updatedAt: null,
    views: 0,
    images,
    comments: [],
  };

  saveList(FREE_POSTS_KEY, [post, ...posts]);
  return post;
}

export function updateFreePost(postId, changes, userId) {
  const posts = getFreePosts();
  const postIndex = posts.findIndex((post) => post.id === postId);

  if (postIndex < 0) throw new Error("POST_NOT_FOUND");
  if (posts[postIndex].authorId !== userId) throw new Error("NOT_POST_OWNER");

  posts[postIndex] = {
    ...posts[postIndex],
    category: changes.category,
    title: changes.title.trim(),
    content: changes.content.trim(),
    images: changes.images,
    updatedAt: new Date().toISOString(),
  };

  saveList(FREE_POSTS_KEY, posts);
  return posts[postIndex];
}

export function deleteFreePost(postId, userId) {
  const posts = getFreePosts();
  const post = posts.find((item) => item.id === postId);

  if (!post) throw new Error("POST_NOT_FOUND");
  if (post.authorId !== userId) throw new Error("NOT_POST_OWNER");

  saveList(FREE_POSTS_KEY, posts.filter((item) => item.id !== postId));
}

export function incrementFreePostViews(postId) {
  const posts = getFreePosts();
  const postIndex = posts.findIndex((post) => post.id === postId);

  if (postIndex < 0) return null;

  posts[postIndex].views = (Number(posts[postIndex].views) || 0) + 1;
  saveList(FREE_POSTS_KEY, posts);
  return posts[postIndex];
}

export function addComment(postId, content, user) {
  const posts = getFreePosts();
  const postIndex = posts.findIndex((post) => post.id === postId);

  if (postIndex < 0) throw new Error("POST_NOT_FOUND");

  const comment = {
    id: createId("comment"),
    authorId: user.id,
    authorName: user.name,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  posts[postIndex].comments = [...(posts[postIndex].comments ?? []), comment];
  saveList(FREE_POSTS_KEY, posts);
  return comment;
}

export function deleteComment(postId, commentId, userId) {
  const posts = getFreePosts();
  const postIndex = posts.findIndex((post) => post.id === postId);

  if (postIndex < 0) throw new Error("POST_NOT_FOUND");

  const comments = posts[postIndex].comments ?? [];
  const comment = comments.find((item) => item.id === commentId);

  if (!comment) throw new Error("COMMENT_NOT_FOUND");
  if (comment.authorId !== userId) throw new Error("NOT_COMMENT_OWNER");

  posts[postIndex].comments = comments.filter((item) => item.id !== commentId);
  saveList(FREE_POSTS_KEY, posts);
}

export function updateAuthorName(userId, authorName) {
  const posts = getFreePosts().map((post) => ({
    ...post,
    authorName: post.authorId === userId ? authorName : post.authorName,
    comments: (post.comments ?? []).map((comment) => ({
      ...comment,
      authorName: comment.authorId === userId ? authorName : comment.authorName,
    })),
  }));

  saveList(FREE_POSTS_KEY, posts);
}

export function deleteUserContent(userId) {
  const posts = getFreePosts()
    .filter((post) => post.authorId !== userId)
    .map((post) => ({
      ...post,
      comments: (post.comments ?? []).filter((comment) => comment.authorId !== userId),
    }));

  saveList(FREE_POSTS_KEY, posts);
}

export function getNotices() {
  initializeBoardStorage();
  return [...readList(NOTICES_KEY)].sort((first, second) => {
    if (first.pinned !== second.pinned) return first.pinned ? -1 : 1;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

export function getNotice(noticeId) {
  return getNotices().find((notice) => notice.id === noticeId) ?? null;
}

export function incrementNoticeViews(noticeId) {
  const notices = getNotices();
  const noticeIndex = notices.findIndex((notice) => notice.id === noticeId);

  if (noticeIndex < 0) return null;

  notices[noticeIndex].views = (Number(notices[noticeIndex].views) || 0) + 1;
  saveList(NOTICES_KEY, notices);
  return notices[noticeIndex];
}
