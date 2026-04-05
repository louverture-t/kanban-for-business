import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, Observable } from '@apollo/client/core';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { getAccessToken, setAccessToken } from '@client/utils/auth';

const httpLink = new HttpLink({
  uri: '/graphql',
  credentials: 'include',
});

const authLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();
  if (token) {
    operation.setContext({
      headers: { authorization: `Bearer ${token}` },
    });
  }
  return forward(operation);
});

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken {
    refreshToken {
      token
      user { _id username role }
    }
  }
`;

const errorLink = new ErrorLink(({ error, operation, forward }) => {
  if (!CombinedGraphQLErrors.is(error)) return;

  const unauthError = error.errors.find(
    (err: { extensions?: { code?: string } }) => err.extensions?.code === 'UNAUTHENTICATED',
  );

  if (!unauthError) return;

  return new Observable((observer) => {
    fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: REFRESH_TOKEN_MUTATION }),
    })
      .then((res) => res.json())
      .then((result) => {
        const newToken = result?.data?.refreshToken?.token;
        if (newToken) {
          setAccessToken(newToken);
          operation.setContext({
            headers: { authorization: `Bearer ${newToken}` },
          });
          forward(operation).subscribe(observer);
        } else {
          setAccessToken(null);
          observer.error(error);
        }
      })
      .catch(() => {
        setAccessToken(null);
        observer.error(error);
      });
  });
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
