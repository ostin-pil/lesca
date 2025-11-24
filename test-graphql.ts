/**
 * GraphQL Coverage Test Script
 *
 * This script tests what data we can get from LeetCode's GraphQL API
 * Run: npx tsx test-graphql.ts
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { writeFile } from 'fs/promises'

import { logger } from '@/shared/utils/src/index'
import type { Problem, TopicTag } from '@lesca/shared/types'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

// GraphQL API response types
interface QuestionResponse extends Omit<Problem, 'isPaidOnly'> {
  // GraphQL returns everything Problem has except isPaidOnly
}

interface ProblemListResponse {
  total: number
  questions: Array<{
    questionId: string
    questionFrontendId: string
    title: string
    titleSlug: string
    difficulty: string
    acRate: number
    paidOnly: boolean
    topicTags: TopicTag[]
  }>
}

interface DiscussionTopicsResponse {
  edges: Array<{
    node: {
      title: string
      viewCount: number
      commentCount: number
      post: {
        voteCount: number
        content: string | null
      }
    }
  }>
}

interface MatchedUserResponse {
  username: string
  profile: {
    ranking: number
    reputation: number
  }
}

interface QuestionTag {
  name: string
  slug: string
  questionCount: number
}

async function queryGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables }),
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
  logger.info('\n📝 Test 1: Problem Query')
  logger.info('Testing: Fetch single problem data')

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
    const data = await queryGraphQL<{ question: QuestionResponse }>(query, { titleSlug: 'two-sum' })
    const question = data.question

    logger.log('✅ SUCCESS')
    logger.log(`   Title: ${question.title}`)
    logger.log(`   ID: ${question.questionId} (Frontend: ${question.questionFrontendId})`)
    logger.log(`   Difficulty: ${question.difficulty}`)
    logger.log(`   Content Length: ${question.content?.length || 0} chars`)
    logger.log(`   Has HTML Content: ${question.content?.includes('<') ? 'YES' : 'NO'}`)
    logger.log(`   Examples: ${question.exampleTestcases ? 'YES' : 'NO'}`)
    logger.log(`   Hints: ${question.hints?.length || 0}`)
    logger.log(`   Tags: ${question.topicTags?.length || 0}`)
    logger.log(`   Code Snippets: ${question.codeSnippets?.length || 0}`)
    logger.log(`   Similar Questions: ${question.similarQuestions ? 'YES' : 'NO'}`)
    logger.log(
      `   Solution Available: ${question.solution?.canSeeDetail ? 'YES' : 'NO (may require premium)'}`
    )

    // Save sample for inspection
    await writeFile('./graphql-test-problem.json', JSON.stringify(data, null, 2))
    logger.log('   Sample saved to: graphql-test-problem.json')

    return {
      success: true,
      hasContent: !!question.content,
      hasExamples: !!question.exampleTestcases,
      hasHints: question.hints?.length > 0,
      hasSolution: !!question.solution,
      canSeeSolution: question.solution?.canSeeDetail,
    }
  } catch (error) {
    logger.log('❌ FAILED')
    logger.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 2: Problem List
async function testProblemListQuery() {
  logger.log('\n📋 Test 2: Problem List Query')
  logger.log('Testing: Fetch list of problems with filters')

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
    const data = await queryGraphQL<{ problemsetQuestionList: ProblemListResponse }>(query, {
      categorySlug: 'algorithms',
      filters: {
        tags: ['array'],
        difficulty: 'EASY',
      },
    })

    const list = data.problemsetQuestionList
    logger.log('✅ SUCCESS')
    logger.log(`   Total Problems: ${list.total}`)
    logger.log(`   Returned: ${list.questions?.length || 0}`)
    if (list.questions?.length > 0) {
      logger.log(`   Sample: ${list.questions[0]!.title} (${list.questions[0]!.difficulty})`)
      logger.log(`   Acceptance: ${list.questions[0]!.acRate}%`)
      logger.log(`   Premium Only: ${list.questions[0]!.paidOnly ? 'YES' : 'NO'}`)
    }

    await writeFile('./graphql-test-list.json', JSON.stringify(data, null, 2))
    logger.log('   Sample saved to: graphql-test-list.json')

    return {
      success: true,
      canFilter: true,
      returnsPaginatedData: true,
    }
  } catch (error) {
    logger.log('❌ FAILED')
    logger.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 3: Discussion Topics
async function testDiscussionQuery() {
  logger.log('\n💬 Test 3: Discussion Query')
  logger.log('Testing: Fetch discussion threads for a problem')

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
    const data = await queryGraphQL<{ questionDiscussionTopics: DiscussionTopicsResponse }>(query, {
      questionSlug: 'two-sum',
    })

    const discussions = data.questionDiscussionTopics
    logger.log('✅ SUCCESS')
    logger.log(`   Returned: ${discussions.edges?.length || 0}`)

    if (discussions.edges?.length > 0) {
      const first = discussions.edges[0]!.node
      logger.log(`   Sample: "${first.title}"`)
      logger.log(`   Views: ${first.viewCount}`)
      logger.log(`   Upvotes: ${first.post.voteCount}`)
      logger.log(`   Comments: ${first.commentCount}`)
      logger.log(`   Has Content: ${first.post.content ? 'YES' : 'NO'}`)
      logger.log(`   Content Length: ${first.post.content?.length || 0} chars`)
    }

    await writeFile('./graphql-test-discussions.json', JSON.stringify(data, null, 2))
    logger.log('   Sample saved to: graphql-test-discussions.json')

    return {
      success: true,
      hasDiscussionContent: discussions.edges?.[0]?.node?.post?.content,
      hasVoteCounts: true,
      hasAuthorInfo: true,
    }
  } catch (error) {
    logger.log('❌ FAILED')
    logger.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 4: User Profile (requires authentication)
async function testUserQuery() {
  logger.log('\n👤 Test 4: User Query (without auth)')
  logger.log('Testing: Fetch user profile data')

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
    const data = await queryGraphQL<{ matchedUser: MatchedUserResponse }>(query, {
      username: 'leetcode',
    })
    const user = data.matchedUser

    logger.log('✅ SUCCESS (Public data only)')
    logger.log(`   Username: ${user?.username}`)
    logger.log(`   Ranking: ${user?.profile?.ranking}`)
    logger.log(`   Reputation: ${user?.profile?.reputation}`)
    logger.log(`   Note: Personal submissions require authentication`)

    return {
      success: true,
      requiresAuth: true,
      canGetPublicProfile: true,
    }
  } catch (error) {
    logger.log('❌ FAILED')
    logger.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Test 5: Company and Tag Lists
async function testMetadataQuery() {
  logger.log('\n🏢 Test 5: Metadata Query')
  logger.log('Testing: Fetch tags and categories')

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
    const data = await queryGraphQL<{ questionTags: QuestionTag[] }>(query)

    const tags = data.questionTags
    logger.log('✅ SUCCESS')
    logger.log(`   Total Tags: ${tags?.length || 0}`)

    if (tags?.length > 0) {
      logger.log(
        `   Sample Tags: ${tags
          .slice(0, 5)
          .map((t: { name: string; questionCount: number }) => `${t.name} (${t.questionCount})`)
          .join(', ')}`
      )
    }

    await writeFile('./graphql-test-metadata.json', JSON.stringify(data, null, 2))
    logger.log('   Sample saved to: graphql-test-metadata.json')

    return {
      success: true,
      hasTags: true,
      hasCategories: true,
    }
  } catch (error) {
    logger.log('❌ FAILED')
    logger.log(`   Error: ${error}`)
    return { success: false }
  }
}

// Main test runner
async function main() {
  logger.log('🧪 LeetCode GraphQL API Coverage Test')
  logger.log('='.repeat(50))

  const results = {
    problem: await testProblemQuery(),
    list: await testProblemListQuery(),
    discussions: await testDiscussionQuery(),
    user: await testUserQuery(),
    metadata: await testMetadataQuery(),
  }

  logger.log('\n' + '='.repeat(50))
  logger.log('📊 SUMMARY')
  logger.log('='.repeat(50))

  // Analyze results
  logger.log('\n✅ What GraphQL Provides:')
  if (results.problem.hasContent) logger.log('   ✓ Problem content (HTML)')
  if (results.problem.hasExamples) logger.log('   ✓ Example test cases')
  if (results.problem.hasHints) logger.log('   ✓ Hints')
  if (results.list.canFilter) logger.log('   ✓ Filtered problem lists')
  if (results.discussions.hasDiscussionContent) logger.log('   ✓ Discussion content')
  if (results.discussions.hasVoteCounts) logger.log('   ✓ Vote counts')
  if (results.metadata.hasTags) logger.log('   ✓ Tags and categories')

  logger.log('\n⚠️  What May Require Browser/Auth:')
  if (!results.problem.canSeeSolution) logger.log('   ⚠ Editorial/Solution content (premium)')
  logger.log('   ⚠ User-specific submissions')
  logger.log('   ⚠ Code execution results')
  logger.log('   ⚠ Dynamic content (if any)')

  logger.log('\n💡 Recommendation:')
  if (results.problem.success && results.list.success && results.discussions.success) {
    logger.log('   ✅ GraphQL covers most use cases!')
    logger.log('   ✅ Browser automation only needed for:')
    logger.log('      - Premium editorial content')
    logger.log('      - User-specific data (submissions)')
    logger.log('      - Any JavaScript-rendered content')
  } else {
    logger.log('   ⚠️  Some tests failed - review errors above')
    logger.log('   ⚠️  May need browser automation as fallback')
  }

  logger.log('\n📝 Next Steps:')
  logger.log('   1. Review generated JSON files for data structure')
  logger.log('   2. Test with authentication (cookies) for premium content')
  logger.log('   3. Decide: Build GraphQL client first, add browser later')

  logger.log('\n')
}

main().catch((err) => logger.error(String(err)))
