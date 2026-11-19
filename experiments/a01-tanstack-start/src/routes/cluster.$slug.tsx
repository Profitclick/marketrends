import {
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'

export const Route = createFileRoute('/cluster/$slug')({
  beforeLoad: ({ params }) => {
    if (params.slug === 'ai') {
      throw redirect({
        to: '/ai',
        statusCode: 308,
      })
    }
    throw notFound()
  },
  component: () => null,
})
