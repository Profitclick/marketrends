import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/compare/$slug')({
  loader: ({ params }) => requireKnownSlug('compare', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Sammenligning {data.slug}</h1></main>
}
