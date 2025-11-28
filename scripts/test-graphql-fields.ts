import { GraphQLClient } from '../packages/api-client/src/graphql-client'
import { RateLimiter } from '../packages/api-client/src/graphql-client'

async function test() {
  const rateLimiter = new RateLimiter(1000, 2000, true)
  const client = new GraphQLClient(undefined, rateLimiter)

  console.log('Testing getProblem with likes/dislikes...')

  const query = `
    query getProblem($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        likes
        dislikes
      }
    }
  `

  try {
    const result = await client.query<any>(query, { titleSlug: 'two-sum' })
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

test()
