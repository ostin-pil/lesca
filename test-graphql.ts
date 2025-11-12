/**
 * GraphQL Coverage Test Script
 *
 * This script tests what data we can get from LeetCode's GraphQL API
 * Run: npx tsx test-graphql.ts
 */

import { writeFile } from 'fs/promises'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function queryGraphQL<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Lesca/1.0 GraphQL Coverage Test',
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const result: GraphQLResponse<T> = await response.json()

  if (result.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(result.errors, null, 2)}`)
  }

  return result.data!
}

// Test 1: Problem Data
async function testProblemQuery() {
  console.log('\n📝 Test 1: Problem Query')
  console.log('Testing: Fetch single problem data')

  const query = `
    query getProblem($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        exampleTestcases
        hints
        mysqlSchemas
        dataSchemas

        # Tags and categories
        topicTags {
          name
          slug
        }

        # Company tags
        companyTagStats

        # Statistics
        stats

        # Code snippets
        codeSnippets {
          lang
          langSlug
          code
        }

        # Similar problems
        similarQuestions

        # Editorial (might require premium)
        solution {
          id
          content
          contentTypeId
          canSeeDetail
        }
      }
    }
  `

  try {
    const data = await queryGraphQL<any>(query, { titleSlug: 'two-sum' })
    const question = data.question

    console.log('✅ SUCCESS')
    console.log(`   Title: ${question.title}`)
    console.log(`   ID: ${question.questionId} (Frontend: ${question.questionFrontendId})`)
    console.log(`   Difficulty: ${question.difficulty}`)
    console.log(`   Content Length: ${question.content?.length || 0} chars`)
    console.log(`   Has HTML Content: ${question.content?.includes('<') ? 'YES' : 'NO'}`)
    console.log(`   Examples: ${question.exampleTestcases ? 'YES' : 'NO'}`)
    console.log(`   Hints: ${question.hints?.length || 0}`)
    console.log(`   Tags: ${question.topicTags?.length || 0}`)
    console.log(`   Code Snippets: ${question.codeSnippets?.length || 0}`)
    console.log(`   Similar Questions: ${question.similarQuestions ? 'YES' : 'NO'}`)
    console.log(`   Solution Available: ${question.solution?.canSeeDetail ? 'YES' : 'NO (may require premium)'}`)

    // Save sample for inspection
    await writeFile('./graphql-test-problem.json', JSON.stringify(data, null, 2))
    console.log('   Sample saved to: graphql-test-problem.json')

    return {
      success: true,
      hasContent: !!question.content,
      hasExamples: !!question.exampleTestcases,
      hasHints: question.hints?.length > 0,
      hasSolution: !!question.solution,
      canSeeSolution: question.solution?.canSeeDetail,
    }
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 2: Problem List
async function testProblemListQuery() {
  console.log('\n📋 Test 2: Problem List Query')
  console.log('Testing: Fetch list of problems with filters')

  const query = `
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
          topicTags {
            name
            slug
          }
        }
      }
    }
  `

  try {
    const data = await queryGraphQL<any>(query, {
      categorySlug: 'algorithms',
      filters: {
        tags: ['array'],
        difficulty: 'EASY',
      }
    })

    const list = data.problemsetQuestionList
    console.log('✅ SUCCESS')
    console.log(`   Total Problems: ${list.total}`)
    console.log(`   Returned: ${list.questions?.length || 0}`)
    if (list.questions?.length > 0) {
      console.log(`   Sample: ${list.questions[0].title} (${list.questions[0].difficulty})`)
      console.log(`   Acceptance: ${list.questions[0].acRate}%`)
      console.log(`   Premium Only: ${list.questions[0].paidOnly ? 'YES' : 'NO'}`)
    }

    await writeFile('./graphql-test-list.json', JSON.stringify(data, null, 2))
    console.log('   Sample saved to: graphql-test-list.json')

    return {
      success: true,
      canFilter: true,
      returnsPaginatedData: true,
    }
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 3: Discussion Topics
async function testDiscussionQuery() {
  console.log('\n💬 Test 3: Discussion Query')
  console.log('Testing: Fetch discussion threads for a problem')

  const query = `
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
              id
              voteCount
              content
              creationDate
              author {
                username
                isActive
              }
            }
          }
        }
      }
    }
  `

  try {
    const data = await queryGraphQL<any>(query, { questionSlug: 'two-sum' })

    const discussions = data.questionDiscussionTopics
    console.log('✅ SUCCESS')
    console.log(`   Returned: ${discussions.edges?.length || 0}`)

    if (discussions.edges?.length > 0) {
      const first = discussions.edges[0].node
      console.log(`   Sample: "${first.title}"`)
      console.log(`   Views: ${first.viewCount}`)
      console.log(`   Upvotes: ${first.post.voteCount}`)
      console.log(`   Comments: ${first.commentCount}`)
      console.log(`   Has Content: ${first.post.content ? 'YES' : 'NO'}`)
      console.log(`   Content Length: ${first.post.content?.length || 0} chars`)
    }

    await writeFile('./graphql-test-discussions.json', JSON.stringify(data, null, 2))
    console.log('   Sample saved to: graphql-test-discussions.json')

    return {
      success: true,
      hasDiscussionContent: discussions.edges?.[0]?.node?.post?.content,
      hasVoteCounts: true,
      hasAuthorInfo: true,
    }
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 4: User Profile (requires authentication)
async function testUserQuery() {
  console.log('\n👤 Test 4: User Query (without auth)')
  console.log('Testing: Fetch user profile data')

  const query = `
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
        badges {
          id
          name
          displayName
          icon
        }
      }
    }
  `

  try {
    const data = await queryGraphQL<any>(query, { username: 'leetcode' })

    console.log('✅ SUCCESS (Public data only)')
    console.log(`   Username: ${data.matchedUser?.username}`)
    console.log(`   Ranking: ${data.matchedUser?.profile?.ranking}`)
    console.log(`   Reputation: ${data.matchedUser?.profile?.reputation}`)
    console.log(`   Note: Personal submissions require authentication`)

    return {
      success: true,
      requiresAuth: true,
      canGetPublicProfile: true,
    }
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 5: Company and Tag Lists
async function testMetadataQuery() {
  console.log('\n🏢 Test 5: Metadata Query')
  console.log('Testing: Fetch tags and categories')

  const query = `
    query getTags {
      questionTags {
        name
        slug
        questionCount
      }
    }
  `

  try {
    const data = await queryGraphQL<any>(query)

    const tags = data.questionTags
    console.log('✅ SUCCESS')
    console.log(`   Total Tags: ${tags?.length || 0}`)

    if (tags?.length > 0) {
      console.log(`   Sample Tags: ${tags.slice(0, 5).map((t: any) => `${t.name} (${t.questionCount})`).join(', ')}`)
    }

    await writeFile('./graphql-test-metadata.json', JSON.stringify(data, null, 2))
    console.log('   Sample saved to: graphql-test-metadata.json')

    return {
      success: true,
      hasTags: true,
      hasCategories: true,
    }
  } catch (error) {
    console.log('❌ FAILED')
    console.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Main test runner
async function main() {
  console.log('🧪 LeetCode GraphQL API Coverage Test')
  console.log('=' .repeat(50))

  const results = {
    problem: await testProblemQuery(),
    list: await testProblemListQuery(),
    discussions: await testDiscussionQuery(),
    user: await testUserQuery(),
    metadata: await testMetadataQuery(),
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 SUMMARY')
  console.log('='.repeat(50))

  // Analyze results
  console.log('\n✅ What GraphQL Provides:')
  if (results.problem.hasContent) console.log('   ✓ Problem content (HTML)')
  if (results.problem.hasExamples) console.log('   ✓ Example test cases')
  if (results.problem.hasHints) console.log('   ✓ Hints')
  if (results.list.canFilter) console.log('   ✓ Filtered problem lists')
  if (results.discussions.hasDiscussionContent) console.log('   ✓ Discussion content')
  if (results.discussions.hasVoteCounts) console.log('   ✓ Vote counts')
  if (results.metadata.hasTags) console.log('   ✓ Tags and categories')

  console.log('\n⚠️  What May Require Browser/Auth:')
  if (!results.problem.canSeeSolution) console.log('   ⚠ Editorial/Solution content (premium)')
  console.log('   ⚠ User-specific submissions')
  console.log('   ⚠ Code execution results')
  console.log('   ⚠ Dynamic content (if any)')

  console.log('\n💡 Recommendation:')
  if (results.problem.success && results.list.success && results.discussions.success) {
    console.log('   ✅ GraphQL covers most use cases!')
    console.log('   ✅ Browser automation only needed for:')
    console.log('      - Premium editorial content')
    console.log('      - User-specific data (submissions)')
    console.log('      - Any JavaScript-rendered content')
  } else {
    console.log('   ⚠️  Some tests failed - review errors above')
    console.log('   ⚠️  May need browser automation as fallback')
  }

  console.log('\n📝 Next Steps:')
  console.log('   1. Review generated JSON files for data structure')
  console.log('   2. Test with authentication (cookies) for premium content')
  console.log('   3. Decide: Build GraphQL client first, add browser later')

  console.log('\n')
}

main().catch(console.error)
