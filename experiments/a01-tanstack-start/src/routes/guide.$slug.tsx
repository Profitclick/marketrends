import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/guide/$slug')({
  loader: ({ params }) => requireKnownSlug('guide', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Guide {data.slug}</h1></main>
}
