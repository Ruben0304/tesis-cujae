/**
 * Custom hooks for GraphQL queries
 * Example usage in components
 */
import { useState, useEffect } from 'react'
import { executeQuery, executeMutation } from './graphql-client'

/**
 * Generic hook for GraphQL queries
 */
export function useGraphQLQuery<T = any>(
  query: string,
  variables?: Record<string, any>
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await executeQuery<T>(query, variables)

        if (isMounted) {
          setData(result)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [query, JSON.stringify(variables)])

  return { data, loading, error }
}

/**
 * Generic hook for GraphQL mutations
 */
export function useGraphQLMutation<T = any>(mutation: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = async (variables?: Record<string, any>) => {
    try {
      setLoading(true)
      setError(null)
      const result = await executeMutation<T>(mutation, variables)
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return { execute, data, loading, error }
}

/**
 * Example: Hook for fetching solar data
 */
export function useSolarDataQuery() {
  const SOLAR_DATA_QUERY = `
    query SolarData {
      solarData {
        current {
          production
          consumption
          batteryLevel
          efficiency
          timestamp
        }
        battery {
          level
          capacityKwh
          charging
          powerKw
          autonomyHours
        }
      }
    }
  `

  return useGraphQLQuery(SOLAR_DATA_QUERY)
}

/**
 * Example: Hook for fetching weather data
 */
export function useWeatherQuery() {
  const WEATHER_QUERY = `
    query Weather {
      weather {
        current {
          temperature
          humidity
          cloudCover
          solarRadiation
          condition
          timestamp
        }
        forecast {
          date
          tempMax
          tempMin
          condition
        }
      }
    }
  `

  return useGraphQLQuery(WEATHER_QUERY)
}
