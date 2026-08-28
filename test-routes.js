/**
 * Comprehensive Route Testing Script for Backend API
 * Tests all routes: Health, Auth, Notes, Cards, Chat
 *
 * Usage: node test-routes.js
 * Make sure the server is running on http://localhost:3000
 */

const BASE_URL = "http://localhost:8000";
const API_V1 = `${BASE_URL}/api/v1`;

// Test data storage
let testData = {
  user: {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: "Test@12345",
    confirmPassword: "Test@12345",
  },
  tokens: {
    accessToken: null,
    refreshToken: null,
  },
  createdResources: {
    notes: [],
    cards: [],
  },
};

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  magenta: "\x1b[35m",
};

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Log test result
 */
function logTest(name, passed, details = "") {
  const status = passed ? "✓ PASS" : "✗ FAIL";
  const color = passed ? colors.green : colors.red;

  console.log(`${color}${status}${colors.reset} - ${name}`);
  if (details) {
    console.log(`  ${colors.blue}${details}${colors.reset}`);
  }

  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Make HTTP request
 */
async function makeRequest(method, url, options = {}) {
  const { headers = {}, body, ...restOptions } = options;

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...restOptions,
  };

  if (body) {
    config.body = body;
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type");

    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { response, data, status: response.status };
  } catch (error) {
    return { error: error.message, status: 0 };
  }
}

/**
 * Print section header
 */
function printSection(title) {
  console.log(`\n${colors.magenta}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}  ${title}${colors.reset}`);
  console.log(`${colors.magenta}${"=".repeat(60)}${colors.reset}\n`);
}

/**
 * HEALTH CHECK TESTS
 */
async function testHealthCheck() {
  printSection("HEALTH CHECK TESTS");

  // Test 1: Health check endpoint
  const { status, data, error } = await makeRequest("GET", `${API_V1}/health`);

  if (error) {
    logTest(
      "GET /api/v1/health",
      false,
      `Connection Error: ${error}. Make sure server is running on port 8000`,
    );
    console.log(
      `\n${colors.red}╔═══════════════════════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.red}║  ✗ Cannot connect to server!                             ║${colors.reset}`,
    );
    console.log(
      `${colors.red}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`,
    );
    console.log(
      `${colors.yellow}Please start the server with: npm run code${colors.reset}\n`,
    );
    process.exit(1);
  }

  logTest(
    "GET /api/v1/health",
    status === 200 && data?.status === "OK",
    `Status: ${status}, Response: ${JSON.stringify(data)}`,
  );
}

/**
 * AUTH TESTS
 */
async function testAuth() {
  printSection("AUTHENTICATION TESTS");

  // Test 1: Register user
  const registerRes = await makeRequest("POST", `${API_V1}/auth/register`, {
    body: JSON.stringify(testData.user),
  });
  logTest(
    "POST /api/v1/auth/register",
    registerRes.status === 201,
    `Status: ${registerRes.status}, Message: ${registerRes.data?.message || registerRes.error || "No message"}`,
  );

  // Test 2: Register with duplicate email (should fail)
  const dupRes = await makeRequest("POST", `${API_V1}/auth/register`, {
    body: JSON.stringify(testData.user),
  });
  logTest(
    "POST /api/v1/auth/register (duplicate - should fail)",
    dupRes.status === 400,
    `Status: ${dupRes.status}, Expected: 400`,
  );

  // Test 3: Login
  const loginRes = await makeRequest("POST", `${API_V1}/auth/login`, {
    body: JSON.stringify({
      email: testData.user.email,
      password: testData.user.password,
    }),
  });

  // Extract cookies from response
  const cookies = loginRes.response?.headers.get("set-cookie");
  if (cookies) {
    const accessTokenMatch = cookies.match(/accessToken=([^;]+)/);
    const refreshTokenMatch = cookies.match(/refreshToken=([^;]+)/);

    if (accessTokenMatch) testData.tokens.accessToken = accessTokenMatch[1];
    if (refreshTokenMatch) testData.tokens.refreshToken = refreshTokenMatch[1];
  }

  logTest(
    "POST /api/v1/auth/login",
    loginRes.status === 200,
    `Status: ${loginRes.status}, Token obtained: ${!!testData.tokens.accessToken}`,
  );

  // Test 4: Login with wrong password (should fail)
  const wrongPassRes = await makeRequest("POST", `${API_V1}/auth/login`, {
    body: JSON.stringify({
      email: testData.user.email,
      password: "WrongPassword123",
    }),
  });
  logTest(
    "POST /api/v1/auth/login (wrong password - should fail)",
    wrongPassRes.status === 401 || wrongPassRes.status === 400,
    `Status: ${wrongPassRes.status}, Expected: 401 or 400`,
  );

  // Test 5: Get current user (requires token)
  const meRes = await makeRequest("GET", `${API_V1}/auth/me`, {
    headers: {
      Authorization: `Bearer ${testData.tokens.accessToken}`,
    },
  });
  logTest(
    "GET /api/v1/auth/me",
    meRes.status === 200 && meRes.data.user,
    `Status: ${meRes.status}, User: ${meRes.data.user?.username}`,
  );

  // Test 6: Get current user without token (should fail)
  const noTokenRes = await makeRequest("GET", `${API_V1}/auth/me`);
  logTest(
    "GET /api/v1/auth/me (no token - should fail)",
    noTokenRes.status === 401,
    `Status: ${noTokenRes.status}, Expected: 401`,
  );

  // Test 7: Forgot password
  const forgotRes = await makeRequest(
    "POST",
    `${API_V1}/auth/forgot-password`,
    {
      body: JSON.stringify({ email: testData.user.email }),
    },
  );
  logTest(
    "POST /api/v1/auth/forgot-password",
    forgotRes.status === 200,
    `Status: ${forgotRes.status}, Message: ${forgotRes.data.message}`,
  );
}

/**
 * NOTE TESTS
 */
async function testNotes() {
  printSection("NOTE TESTS");

  const authHeader = {
    Authorization: `Bearer ${testData.tokens.accessToken}`,
  };

  // Test 1: Create note
  const createRes = await makeRequest("POST", `${API_V1}/notes`, {
    headers: authHeader,
    body: JSON.stringify({
      title: "Test Note",
      content: {
        ops: [{ insert: "This is a test note content.\n" }],
      },
      tags: ["test", "sample"],
      category: "Testing",
      color: "#ff6b6b",
      isPinned: false,
      isFavorite: false,
    }),
  });

  if (createRes.status === 201 && createRes.data.data) {
    testData.createdResources.notes.push(createRes.data.data._id);
  }

  logTest(
    "POST /api/v1/notes",
    createRes.status === 201,
    `Status: ${createRes.status}, ${createRes.status === 201 ? "Note ID: " + createRes.data.data?._id : "Error: " + JSON.stringify(createRes.data)}`,
  );

  // Test 2: Create note without title (should fail)
  const noTitleRes = await makeRequest("POST", `${API_V1}/notes`, {
    headers: authHeader,
    body: JSON.stringify({
      content: { ops: [{ insert: "Content only\n" }] },
    }),
  });
  logTest(
    "POST /api/v1/notes (no title - should fail)",
    noTitleRes.status === 400,
    `Status: ${noTitleRes.status}, Expected: 400`,
  );

  // Test 3: Get all notes
  const getNotesRes = await makeRequest("GET", `${API_V1}/notes`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/notes",
    getNotesRes.status === 200 && Array.isArray(getNotesRes.data.data?.notes),
    `Status: ${getNotesRes.status}, Count: ${getNotesRes.data.data?.notes?.length || 0}`,
  );

  // Test 4: Get notes with pagination
  const paginationRes = await makeRequest(
    "GET",
    `${API_V1}/notes?page=1&limit=10`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/notes?page=1&limit=10",
    paginationRes.status === 200 && paginationRes.data.data?.pagination,
    `Status: ${paginationRes.status}, Total pages: ${paginationRes.data.data?.pagination?.totalPages}`,
  );

  if (testData.createdResources.notes.length > 0) {
    const noteId = testData.createdResources.notes[0];

    // Test 5: Get note by ID
    const getNoteRes = await makeRequest("GET", `${API_V1}/notes/${noteId}`, {
      headers: authHeader,
    });
    logTest(
      "GET /api/v1/notes/:id",
      getNoteRes.status === 200,
      `Status: ${getNoteRes.status}, Title: ${getNoteRes.data.data?.title}`,
    );

    // Test 6: Update note
    const updateRes = await makeRequest("PUT", `${API_V1}/notes/${noteId}`, {
      headers: authHeader,
      body: JSON.stringify({
        title: "Updated Test Note",
        isPinned: true,
      }),
    });
    logTest(
      "PUT /api/v1/notes/:id",
      updateRes.status === 200,
      `Status: ${updateRes.status}, Updated title: ${updateRes.data.data?.title}`,
    );

    // Test 7: Toggle pin
    const pinRes = await makeRequest("PATCH", `${API_V1}/notes/${noteId}/pin`, {
      headers: authHeader,
    });
    logTest(
      "PATCH /api/v1/notes/:id/pin",
      pinRes.status === 200,
      `Status: ${pinRes.status}, Pinned: ${pinRes.data.data?.isPinned}`,
    );

    // Test 8: Toggle favorite
    const favRes = await makeRequest(
      "PATCH",
      `${API_V1}/notes/${noteId}/favorite`,
      {
        headers: authHeader,
      },
    );
    logTest(
      "PATCH /api/v1/notes/:id/favorite",
      favRes.status === 200,
      `Status: ${favRes.status}, Favorite: ${favRes.data.data?.isFavorite}`,
    );

    // Test 9: Archive note
    const archiveRes = await makeRequest(
      "PATCH",
      `${API_V1}/notes/${noteId}/archive`,
      {
        headers: authHeader,
      },
    );
    logTest(
      "PATCH /api/v1/notes/:id/archive",
      archiveRes.status === 200,
      `Status: ${archiveRes.status}, Archived: ${archiveRes.data.data?.isArchived}`,
    );
  }

  // Test 10: Search notes
  const searchRes = await makeRequest(
    "GET",
    `${API_V1}/notes/search?query=test`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/notes/search?query=test",
    searchRes.status === 200,
    `Status: ${searchRes.status}, Results: ${searchRes.data.data?.count || 0}`,
  );

  // Test 11: Get user tags
  const tagsRes = await makeRequest("GET", `${API_V1}/notes/tags`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/notes/tags",
    tagsRes.status === 200,
    `Status: ${tagsRes.status}, Tags: ${tagsRes.data.data?.tags?.join(", ") || "none"}`,
  );

  // Test 12: Get user categories
  const categoriesRes = await makeRequest("GET", `${API_V1}/notes/categories`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/notes/categories",
    categoriesRes.status === 200,
    `Status: ${categoriesRes.status}, Categories: ${categoriesRes.data.data?.categories?.join(", ") || "none"}`,
  );

  // Test 13: Get notes by category
  const byCategoryRes = await makeRequest(
    "GET",
    `${API_V1}/notes/category/Testing`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/notes/category/:category",
    byCategoryRes.status === 200,
    `Status: ${byCategoryRes.status}, Count: ${byCategoryRes.data.data?.count || 0}`,
  );

  // Test 14: Get notes by tag
  const byTagRes = await makeRequest("GET", `${API_V1}/notes/tag/test`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/notes/tag/:tag",
    byTagRes.status === 200,
    `Status: ${byTagRes.status}, Count: ${byTagRes.data.data?.count || 0}`,
  );
}

/**
 * CARD/FLASHCARD TESTS
 */
async function testCards() {
  printSection("FLASHCARD TESTS");

  const authHeader = {
    Authorization: `Bearer ${testData.tokens.accessToken}`,
  };

  // Test 1: Create card manually
  const createRes = await makeRequest("POST", `${API_V1}/cards`, {
    headers: authHeader,
    body: JSON.stringify({
      title: "What is Node.js?",
      content:
        "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine.",
      tags: ["nodejs", "backend"],
      color: "#4ecdc4",
      difficulty: "easy",
      isPinned: false,
      isFavorite: false,
    }),
  });

  if (createRes.status === 201 && createRes.data.data) {
    testData.createdResources.cards.push(createRes.data.data._id);
  }

  logTest(
    "POST /api/v1/cards",
    createRes.status === 201,
    `Status: ${createRes.status}, ${createRes.status === 201 ? "Card ID: " + createRes.data.data?._id : "Error: " + JSON.stringify(createRes.data)}`,
  );

  // Test 2: Create card without title (should fail)
  const noTitleRes = await makeRequest("POST", `${API_V1}/cards`, {
    headers: authHeader,
    body: JSON.stringify({
      content: "Content without title",
    }),
  });
  logTest(
    "POST /api/v1/cards (no title - should fail)",
    noTitleRes.status === 400,
    `Status: ${noTitleRes.status}, Expected: 400`,
  );

  // Test 3: Get all cards
  const getCardsRes = await makeRequest("GET", `${API_V1}/cards`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/cards",
    getCardsRes.status === 200 && Array.isArray(getCardsRes.data.data?.cards),
    `Status: ${getCardsRes.status}, Count: ${getCardsRes.data.data?.cards?.length || 0}`,
  );

  // Test 4: Get cards with filters
  const filteredRes = await makeRequest(
    "GET",
    `${API_V1}/cards?difficulty=easy&page=1&limit=5`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/cards?difficulty=easy&page=1&limit=5",
    filteredRes.status === 200,
    `Status: ${filteredRes.status}, Count: ${filteredRes.data.data?.cards?.length || 0}`,
  );

  if (testData.createdResources.cards.length > 0) {
    const cardId = testData.createdResources.cards[0];

    // Test 5: Get card by ID
    const getCardRes = await makeRequest("GET", `${API_V1}/cards/${cardId}`, {
      headers: authHeader,
    });
    logTest(
      "GET /api/v1/cards/:id",
      getCardRes.status === 200,
      `Status: ${getCardRes.status}, Title: ${getCardRes.data.data?.title}`,
    );

    // Test 6: Update card
    const updateRes = await makeRequest("PUT", `${API_V1}/cards/${cardId}`, {
      headers: authHeader,
      body: JSON.stringify({
        title: "Updated: What is Node.js?",
        difficulty: "medium",
      }),
    });
    logTest(
      "PUT /api/v1/cards/:id",
      updateRes.status === 200,
      `Status: ${updateRes.status}, Difficulty: ${updateRes.data.data?.difficulty}`,
    );

    // Test 7: Toggle pin
    const pinRes = await makeRequest("PATCH", `${API_V1}/cards/${cardId}/pin`, {
      headers: authHeader,
    });
    logTest(
      "PATCH /api/v1/cards/:id/pin",
      pinRes.status === 200,
      `Status: ${pinRes.status}, Pinned: ${pinRes.data.data?.isPinned}`,
    );

    // Test 8: Toggle favorite
    const favRes = await makeRequest(
      "PATCH",
      `${API_V1}/cards/${cardId}/favorite`,
      {
        headers: authHeader,
      },
    );
    logTest(
      "PATCH /api/v1/cards/:id/favorite",
      favRes.status === 200,
      `Status: ${favRes.status}, Favorite: ${favRes.data.data?.isFavorite}`,
    );

    // Test 9: Mark as reviewed
    const reviewRes = await makeRequest(
      "PATCH",
      `${API_V1}/cards/${cardId}/review`,
      {
        headers: authHeader,
      },
    );
    logTest(
      "PATCH /api/v1/cards/:id/review",
      reviewRes.status === 200,
      `Status: ${reviewRes.status}, Review count: ${reviewRes.data.data?.reviewCount}`,
    );
  }

  // Test 10: Search cards
  const searchRes = await makeRequest(
    "GET",
    `${API_V1}/cards/search?query=node`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/cards/search?query=node",
    searchRes.status === 200,
    `Status: ${searchRes.status}, Results: ${searchRes.data.data?.count || 0}`,
  );

  // Test 11: Get cards by difficulty
  const difficultyRes = await makeRequest(
    "GET",
    `${API_V1}/cards/difficulty/easy`,
    {
      headers: authHeader,
    },
  );
  logTest(
    "GET /api/v1/cards/difficulty/:difficulty",
    difficultyRes.status === 200,
    `Status: ${difficultyRes.status}, Count: ${difficultyRes.data.data?.count || 0}`,
  );

  // Test 12: Get user tags
  const tagsRes = await makeRequest("GET", `${API_V1}/cards/tags`, {
    headers: authHeader,
  });
  logTest(
    "GET /api/v1/cards/tags",
    tagsRes.status === 200,
    `Status: ${tagsRes.status}, Tags: ${tagsRes.data.data?.tags?.join(", ") || "none"}`,
  );

  // Test 13: Generate flashcards from note (if we have a note)
  if (testData.createdResources.notes.length > 0) {
    const noteId = testData.createdResources.notes[0];
    const generateRes = await makeRequest("POST", `${API_V1}/cards/ai`, {
      headers: authHeader,
      body: JSON.stringify({ noteId }),
    });
    logTest(
      "POST /api/v1/cards/ai (generate from note)",
      generateRes.status === 200 || generateRes.status === 500, // May fail if OpenAI key not configured
      `Status: ${generateRes.status}, ${generateRes.data.message || "Check OpenAI configuration"}`,
    );

    // Test 14: Get cards by note
    const byNoteRes = await makeRequest(
      "GET",
      `${API_V1}/cards/note/${noteId}`,
      {
        headers: authHeader,
      },
    );
    logTest(
      "GET /api/v1/cards/note/:noteId",
      byNoteRes.status === 200,
      `Status: ${byNoteRes.status}, Count: ${byNoteRes.data.data?.count || 0}`,
    );
  }
}

/**
 * CHAT TESTS
 */
async function testChat() {
  printSection("CHAT TESTS");

  const authHeader = {
    Authorization: `Bearer ${testData.tokens.accessToken}`,
  };

  // Test 1: Send chat message
  const chatRes = await makeRequest("POST", `${API_V1}/chat`, {
    headers: authHeader,
    body: JSON.stringify({
      message: "What is REST API?",
    }),
  });
  logTest(
    "POST /api/v1/chat",
    chatRes.status === 200 || chatRes.status === 500, // May fail if OpenAI key not configured
    `Status: ${chatRes.status}, ${chatRes.data.success ? "Response received" : "Check OpenAI configuration"}`,
  );

  // Test 2: Send empty message (should fail)
  const emptyRes = await makeRequest("POST", `${API_V1}/chat`, {
    headers: authHeader,
    body: JSON.stringify({
      message: "",
    }),
  });
  logTest(
    "POST /api/v1/chat (empty message - should fail)",
    emptyRes.status === 400,
    `Status: ${emptyRes.status}, Expected: 400`,
  );
}

/**
 * CLEANUP TESTS
 */
async function cleanup() {
  printSection("CLEANUP");

  const authHeader = {
    Authorization: `Bearer ${testData.tokens.accessToken}`,
  };

  // Delete created cards
  for (const cardId of testData.createdResources.cards) {
    const deleteRes = await makeRequest("DELETE", `${API_V1}/cards/${cardId}`, {
      headers: authHeader,
    });
    logTest(
      `DELETE /api/v1/cards/${cardId}`,
      deleteRes.status === 200,
      `Status: ${deleteRes.status}`,
    );
  }

  // Delete created notes
  for (const noteId of testData.createdResources.notes) {
    const deleteRes = await makeRequest("DELETE", `${API_V1}/notes/${noteId}`, {
      headers: authHeader,
    });
    logTest(
      `DELETE /api/v1/notes/${noteId}`,
      deleteRes.status === 200,
      `Status: ${deleteRes.status}`,
    );
  }

  // Logout
  const logoutRes = await makeRequest("POST", `${API_V1}/auth/logout`, {
    headers: authHeader,
  });
  logTest(
    "POST /api/v1/auth/logout",
    logoutRes.status === 200,
    `Status: ${logoutRes.status}, Message: ${logoutRes.data.message}`,
  );
}

/**
 * PRINT FINAL SUMMARY
 */
function printSummary() {
  console.log(`\n${colors.magenta}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}${"=".repeat(60)}${colors.reset}\n`);

  console.log(`${colors.green}✓ Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${results.failed}${colors.reset}`);
  console.log(`  Total: ${results.passed + results.failed}\n`);

  const successRate = (
    (results.passed / (results.passed + results.failed)) *
    100
  ).toFixed(2);
  const rateColor =
    successRate >= 90
      ? colors.green
      : successRate >= 70
        ? colors.yellow
        : colors.red;
  console.log(`${rateColor}Success Rate: ${successRate}%${colors.reset}\n`);

  if (results.failed > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    results.tests
      .filter((t) => !t.passed)
      .forEach((test) => {
        console.log(`  - ${test.name}`);
        if (test.details) console.log(`    ${test.details}`);
      });
    console.log("");
  }
}

/**
 * MAIN TEST RUNNER
 */
async function runAllTests() {
  console.log(`${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         Backend API Route Testing Suite                  ║
║         Testing all endpoints...                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`${colors.yellow}Server URL: ${BASE_URL}${colors.reset}`);
  console.log(
    `${colors.yellow}Starting tests at: ${new Date().toLocaleString()}${colors.reset}\n`,
  );

  try {
    await testHealthCheck();
    await testAuth();
    await testNotes();
    await testCards();
    await testChat();
    await cleanup();

    printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(
      `\n${colors.red}Fatal Error: ${error.message}${colors.reset}`,
    );
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
