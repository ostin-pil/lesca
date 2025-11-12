# LeetCode GraphQL API Coverage Analysis

**Date**: 2024-11-12
**Test Results**: 3/5 queries successful

## Summary

LeetCode's GraphQL API provides **excellent coverage** for core problem data. The API can handle most scraping needs without browser automation.

## ✅ What Works (GraphQL Only)

### 1. Problem Data ⭐⭐⭐⭐⭐
**Status**: Fully functional, comprehensive data

```graphql
query getProblem($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    content  # Full HTML content
    difficulty
    exampleTestcases
    hints
    topicTags { name, slug }
    companyTagStats
    stats
    codeSnippets { lang, langSlug, code }
    similarQuestions
    solution { id, content, canSeeDetail }
  }
}
```

**Data Provided**:
- ✅ Full problem statement (HTML formatted)
- ✅ Examples with inputs/outputs
- ✅ Constraints (embedded in content HTML)
- ✅ Hints (array of hint strings)
- ✅ Topic tags (array, array, hash-table, etc.)
- ✅ Code templates for 19+ languages
- ✅ Statistics (acceptance rate, submissions)
- ✅ Similar problems (IDs and slugs)
- ✅ Solution availability flag

**Sample Data Structure**:
```json
{
  "questionId": "1",
  "questionFrontendId": "1",
  "title": "Two Sum",
  "titleSlug": "two-sum",
  "content": "<p>Given an array of integers...</p>",
  "difficulty": "Easy",
  "exampleTestcases": "[2,7,11,15]\n9\n[3,2,4]\n6",
  "hints": ["A really brute force way...", "..."],
  "topicTags": [
    { "name": "Array", "slug": "array" },
    { "name": "Hash Table", "slug": "hash-table" }
  ],
  "stats": "{\"totalAccepted\": \"19.5M\", \"acRate\": \"56.5%\"}",
  "codeSnippets": [
    { "lang": "Python3", "langSlug": "python3", "code": "..." },
    { "lang": "JavaScript", "langSlug": "javascript", "code": "..." }
  ]
}
```

**Conclusion**: Problem scraping can be 100% GraphQL-based. No browser automation needed.

---

### 2. Problem Lists ⭐⭐⭐⭐⭐
**Status**: Fully functional with filtering

```graphql
query problemsetQuestionList($categorySlug: String, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      acRate
      paidOnly: isPaidOnly
      topicTags { name, slug }
    }
  }
}
```

**Filtering Capabilities**:
- ✅ By difficulty (EASY, MEDIUM, HARD)
- ✅ By tags (array, ["array", "hash-table"])
- ✅ By category (algorithms, database, shell)
- ✅ Premium vs free problems

**Sample Response**:
- Total available: 417 problems (with filters)
- Returns: 50 problems per query
- Pagination: Supported (use skip/limit)

**Sample Entry**:
```json
{
  "questionFrontendId": "1",
  "title": "Two Sum",
  "titleSlug": "two-sum",
  "difficulty": "Easy",
  "acRate": 56.54,
  "paidOnly": false,
  "topicTags": [{"name": "Array"}, {"name": "Hash Table"}]
}
```

**Conclusion**: List scraping can be 100% GraphQL-based.

---

### 3. User Profiles ⭐⭐⭐⭐
**Status**: Works for public data

```graphql
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      aboutMe
      reputation
      ranking
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
    badges { id, name, displayName, icon }
  }
}
```

**Data Provided**:
- ✅ Public profile information
- ✅ Ranking and reputation
- ✅ Submission statistics (aggregated)
- ✅ Badges

**Limitations**:
- ⚠️ Personal submission details require authentication
- ⚠️ Submission code not available via GraphQL

---

## ❌ What Doesn't Work (Yet)

### 4. Discussion Threads ⚠️
**Status**: Query failed (400 Bad Request)

**Attempted Query**:
```graphql
query discussionTopics($questionSlug: String!) {
  questionDiscussionTopics(
    questionSlug: $questionSlug
    orderBy: HOT
    first: 10
  ) {
    edges {
      node {
        id
        title
        commentCount
        viewCount
        post {
          voteCount
          content
          author { username }
        }
      }
    }
  }
}
```

**Possible Issues**:
- Schema name might be different
- May require authentication
- May need different query structure
- Endpoint might have changed

**Options**:
1. Research correct GraphQL schema (try GraphQL introspection)
2. Use browser automation to scrape discussions from HTML
3. Skip discussions for MVP

---

### 5. Tags/Metadata ⚠️
**Status**: Query failed (400 Bad Request)

**Attempted Query**:
```graphql
query getTags {
  questionTags {
    name
    slug
    questionCount
  }
}
```

**Workaround**:
- Tags are already available in problem list queries
- Can build tag database from problem list responses
- Not critical for core functionality

---

## 📊 Coverage Assessment

| Feature | GraphQL | Browser | Priority | Decision |
|---------|---------|---------|----------|----------|
| Problem Content | ✅ | - | High | GraphQL only |
| Problem Lists | ✅ | - | High | GraphQL only |
| Code Snippets | ✅ | - | Medium | GraphQL only |
| Hints | ✅ | - | Medium | GraphQL only |
| Tags | ✅* | - | Medium | From problem lists |
| Statistics | ✅ | - | Medium | GraphQL only |
| Editorial/Solution | ⚠️ | ✅ | Low | Browser (premium) |
| Discussions | ❌ | ✅ | Low | Browser or fix query |
| User Submissions | ❌ | ✅ | Low | Not in MVP |
| Test Execution | ❌ | ✅ | Low | Not in MVP |

*Available indirectly through problem queries

---

## 💡 Recommendations

### Phase 1 (MVP - 1 week)
**Use GraphQL Only**

```typescript
// What to build:
- GraphQL client with cookie auth
- Problem scraper (single + list)
- HTML to Markdown converter
- File storage
- Basic CLI

// What to skip:
- Browser automation
- Discussion scraping
- Editorial content
- User submissions
```

**Rationale**:
- GraphQL provides 80% of value
- Much simpler to implement
- Faster execution (no browser overhead)
- More reliable (no selector breakage)

### Phase 2 (Enhancements - 1 week)
**Add Browser Automation Selectively**

```typescript
// Use browser for:
- Premium editorial content (if user has subscription)
- Discussion scraping (if GraphQL query can't be fixed)
- User-specific data (submissions, progress)

// Implementation:
- Create BrowserDriver interface
- Implement PlaywrightDriver
- Use only when GraphQL insufficient
```

---

## 🔍 GraphQL Schema Discovery

To find correct queries for discussions/tags, we need to:

### Option 1: GraphQL Introspection
```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
}
```

### Option 2: Browser DevTools
1. Open LeetCode.com
2. Open DevTools → Network tab
3. Filter: GraphQL
4. Navigate to discussions page
5. Copy actual queries used by the site

### Option 3: LeetCode API Repository
- Search GitHub for "leetcode-graphql-schema"
- Check unofficial API documentation
- Review community reverse-engineering efforts

---

## 🎯 Implementation Priority

### Priority 1: Core Problem Scraping (This Week)
```typescript
✅ GraphQL client
✅ Cookie authentication
✅ Problem query implementation
✅ Problem list query implementation
✅ Basic data models
```

### Priority 2: Processing & Output (This Week)
```typescript
✅ HTML to Markdown converter
✅ Obsidian format converter
✅ File system storage
✅ CLI commands
```

### Priority 3: Browser Automation (Week 2, if needed)
```typescript
⏳ Browser driver interface
⏳ Playwright implementation
⏳ Selector management
⏳ Discussion scraper strategy
```

### Priority 4: Enhancements (Week 2)
```typescript
⏳ Quality filtering
⏳ Caching
⏳ Rate limiting
⏳ Resume capability
```

---

## 📝 Action Items

### Immediate (Today)
- [x] Test GraphQL API coverage
- [x] Document findings
- [ ] Set up TypeScript project structure
- [ ] Create shared types based on GraphQL responses
- [ ] Implement basic GraphQL client

### This Week
- [ ] Implement problem scraper
- [ ] Implement HTML to Markdown conversion
- [ ] Implement file storage
- [ ] Build basic CLI
- [ ] Test end-to-end with "Two Sum"

### Next Week (If Time)
- [ ] Research discussion GraphQL queries
- [ ] Add browser automation (if discussions needed)
- [ ] Add quality filtering
- [ ] Add caching

---

## 🚀 Conclusion

**GraphQL API is sufficient for MVP!**

We can build a fully functional LeetCode scraper using only GraphQL for:
- ✅ Individual problem scraping
- ✅ Bulk problem list scraping
- ✅ Filtering by difficulty, tags, companies
- ✅ All metadata and statistics

Browser automation can be added later if needed for:
- Premium editorial content
- Discussion threads (if GraphQL query can't be fixed)
- User-specific data

**Recommendation**: Proceed with GraphQL-first implementation. Add browser automation only if specific needs arise.

---

## 📚 References

- GraphQL Endpoint: `https://leetcode.com/graphql`
- Test Files:
  - `graphql-test-problem.json` (14 KB)
  - `graphql-test-list.json` (27 KB)
- Test Script: `test-graphql.ts`
