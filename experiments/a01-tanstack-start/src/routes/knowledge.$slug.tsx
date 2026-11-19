import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/knowledge/$slug')({
  loader: ({ params }) => requireKnownSlug('knowledge', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Kunnskap {data.slug}</h1></main>
}
