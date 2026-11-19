import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/entity/$slug')({
  loader: ({ params }) => requireKnownSlug('entity', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Aktør {data.slug}</h1></main>
}
