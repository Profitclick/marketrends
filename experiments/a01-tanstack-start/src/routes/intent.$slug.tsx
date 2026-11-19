import { createFileRoute } from '@tanstack/react-router'
import { requireKnownSlug } from '../lib/route-existence'

export const Route = createFileRoute('/intent/$slug')({
  loader: ({ params }) => requireKnownSlug('intent', params.slug),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <main><h1>Intent {data.slug}</h1></main>
}
