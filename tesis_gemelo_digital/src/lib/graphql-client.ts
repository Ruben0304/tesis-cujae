/**
 * GraphQL client configuration using urql
 */
import { Client, cacheExchange, fetchExchange } from 'urql'

// GraphQL endpoint (FastAPI backend)
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8000/graphql'

const SESSION_KEY = 'gd_auth_user'

/**
 * Read the JWT token from localStorage (only available in browser).
 * Returns undefined in SSR context.
 */
function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (!stored) return undefined
    const parsed = JSON.parse(stored)
    return parsed?.token as string | undefined
  } catch {
    return undefined
  }
}

/**
 * Create urql client instance.
 * fetchOptions is a function so the token is read fresh on every request.
 */
export const graphqlClient = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    const token = getAuthToken()
    return {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  },
})

/**
 * Execute a GraphQL query
 */
export async function executeQuery<T = any>(
  query: string,
  variables?: Record<string, any>,
  requestPolicy?: 'cache-first' | 'cache-only' | 'network-only' | 'cache-and-network'
): Promise<T> {
  const result = await graphqlClient.query(query, variables, { requestPolicy }).toPromise()

  if (result.error) {
    console.error('GraphQL Error:', result.error)
    throw new Error(result.error.message)
  }

  return result.data
}

/**
 * Execute a GraphQL mutation
 */
export async function executeMutation<T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<T> {
  const result = await graphqlClient.mutation(mutation, variables).toPromise()

  if (result.error) {
    console.error('GraphQL Error:', result.error)
    throw new Error(result.error.message)
  }

  return result.data
}
