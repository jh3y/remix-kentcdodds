import * as React from 'react'
import {motion} from 'framer-motion'
import type {LoaderFunction, HeadersFunction, MetaFunction} from 'remix'
import {Link, json, useLoaderData} from 'remix'
import {useSearchParams} from 'react-router-dom'
import type {KCDHandle, MdxListItem, Team} from '~/types'
import {useRootData} from '~/utils/use-root-data'
import {Grid} from '~/components/grid'
import {
  getImageBuilder,
  getImgProps,
  getSocialImageWithPreTitle,
  images,
} from '~/images'
import {H2, H3, H6, Paragraph} from '~/components/typography'
import {
  Parallax,
  ParallaxItem,
  ParallaxWrapper,
} from '~/components/parallax/parallax'
import {SearchIcon} from '~/components/icons/search-icon'
import {ArticleCard} from '~/components/article-card'
import {ArrowLink} from '~/components/arrow-button'
import {FeaturedSection} from '~/components/sections/featured-section'
import {Tag} from '~/components/tag'
import {getBlogMdxListItems} from '~/utils/mdx'
import {filterPosts, getRankingLeader} from '~/utils/blog'
import {
  HeroSection,
  getHeroImageProps,
} from '~/components/sections/hero-section'
import {PlusIcon} from '~/components/icons/plus-icon'
import {Button} from '~/components/button'
import type {Timings} from '~/utils/metrics.server'
import {getServerTimeHeader} from '~/utils/metrics.server'
import {ServerError} from '~/components/errors'
import {
  formatDate,
  formatNumber,
  getDisplayUrl,
  getUrl,
  reuseUsefulLoaderHeaders,
  teams,
  useUpdateQueryStringValueWithoutNavigation,
} from '~/utils/misc'
import {TeamStats} from '~/components/team-stats'
import {Spacer} from '~/components/spacer'
import {
  getAllBlogPostReadRankings,
  getBlogReadRankings,
  getBlogRecommendations,
  getReaderCount,
  getTotalPostReads,
  ReadRankings,
} from '~/utils/blog.server'
import {useTeam} from '~/utils/team-provider'
import type {LoaderData as RootLoaderData} from '../root'
import {getSocialMetas} from '~/utils/seo'

const handleId = 'blog'
export const handle: KCDHandle = {
  id: handleId,
  getSitemapEntries: () => [{route: `/blog`, priority: 0.7}],
}

type LoaderData = {
  posts: Array<MdxListItem>
  recommended: MdxListItem | undefined
  tags: Array<string>
  allPostReadRankings: Record<string, ReadRankings>
  readRankings: ReadRankings
  totalReads: string
  totalBlogReaders: string
  overallLeadingTeam: Team | null
}

const SkiParallax = () => (
  <motion.div
    initial={{scale: 1.5, opacity: 0}}
    animate={{scale: 1, opacity: 1}}
    transition={{duration: 0.75}}
    className="w-full"
  >
    <ParallaxWrapper>
      <Parallax
        config={{
          rotate: 0.01,
          rotateX: -0.1,
          rotateY: 0.25,
          coefficientX: 1.25,
          coefficientY: 1.25,
        }}
      >
        <ParallaxItem
          config={{
            width: 100,
            positionX: 50,
            positionY: 65,
            positionZ: 3,
            moveX: 0.45,
            moveY: 0.25,
          }}
        >
          <motion.img
            className="w-full h-auto max-h-50vh object-contain"
            {...getHeroImageProps(images.skis)}
            initial={{scale: 1.5, opacity: 0}}
            animate={{scale: 1, opacity: 1}}
            transition={{duration: 0.75}}
          />
        </ParallaxItem>
      </Parallax>
    </ParallaxWrapper>
  </motion.div>
)

export const loader: LoaderFunction = async ({request}) => {
  const timings: Timings = {}

  const [
    posts,
    [recommended],
    readRankings,
    totalReads,
    totalBlogReaders,
    allPostReadRankings,
  ] = await Promise.all([
    getBlogMdxListItems({request, timings}),
    getBlogRecommendations(request, {limit: 1}),
    getBlogReadRankings({request}),
    getTotalPostReads(request),
    getReaderCount(request),
    getAllBlogPostReadRankings({request}),
  ])

  const tags = new Set<string>()
  for (const post of posts) {
    for (const category of post.frontmatter.categories ?? []) {
      tags.add(category)
    }
  }

  const data: LoaderData = {
    posts,
    recommended,
    readRankings,
    allPostReadRankings,
    totalReads: formatNumber(totalReads),
    totalBlogReaders: formatNumber(totalBlogReaders),
    tags: Array.from(tags),
    overallLeadingTeam: getRankingLeader(readRankings)?.team ?? null,
  }

  return json(data, {
    headers: {
      'Cache-Control': 'private, max-age=3600',
      Vary: 'Cookie',
      'Server-Timing': getServerTimeHeader(timings),
    },
  })
}

export const headers: HeadersFunction = reuseUsefulLoaderHeaders

export const meta: MetaFunction = ({data, parentsData}) => {
  const {requestInfo} = parentsData.root as RootLoaderData
  const {totalBlogReaders, posts} = data as LoaderData

  return {
    ...getSocialMetas({
      title: 'The Kent C. Dodds Blog',
      description: `Join ${totalBlogReaders} people who have read Kent's ${formatNumber(
        posts.length,
      )} articles on JavaScript, TypeScript, React, Testing, Career, and more.`,
      keywords:
        'JavaScript, TypeScript, React, Testing, Career, Software Development, Kent C. Dodds Blog',
      url: getUrl(requestInfo),
      image: getSocialImageWithPreTitle({
        url: getDisplayUrl(requestInfo),
        featuredImage: images.skis.id,
        preTitle: 'Check out this Blog',
        title: `Priceless insights, ideas, and experiences for your dev work`,
      }),
    }),
  }
}

// should be divisible by 3 and 2 (large screen, and medium screen).
const PAGE_SIZE = 12
const initialIndexToShow = PAGE_SIZE

const specialQueryRegex = /(?<not>!)?leader:(?<team>\w+)(\s|$)?/g
const isTeam = (team?: string): team is Team => teams.includes(team as Team)

function BlogHome() {
  const {requestInfo} = useRootData()
  const [searchParams] = useSearchParams()

  const [userTeam] = useTeam()

  const [queryValue, setQuery] = React.useState<string>(() => {
    return searchParams.get('q') ?? ''
  })
  const query = queryValue.trim()

  useUpdateQueryStringValueWithoutNavigation('q', query)

  const data = useLoaderData<LoaderData>()
  const allPosts = data.posts

  const getLeadingTeamForSlug = React.useCallback(
    (slug: string) => {
      return getRankingLeader(data.allPostReadRankings[slug])?.team
    },
    [data.allPostReadRankings],
  )

  const regularQuery = query.replace(specialQueryRegex, '').trim()

  const matchingPosts = React.useMemo(() => {
    const r = new RegExp(specialQueryRegex)
    let match = r.exec(query)
    const leaders: Array<Team> = []
    const nonLeaders: Array<Team> = []
    while (match) {
      const {team, not} = match.groups ?? {}
      const upperTeam = team?.toUpperCase()
      if (isTeam(upperTeam)) {
        if (not) {
          nonLeaders.push(upperTeam)
        } else {
          leaders.push(upperTeam)
        }
      }
      match = r.exec(query)
    }

    const teamPosts =
      leaders.length || nonLeaders.length
        ? allPosts.filter(post => {
            const leader = getLeadingTeamForSlug(post.slug)
            if (leaders.length && leader && leaders.includes(leader)) {
              return true
            }
            if (
              nonLeaders.length &&
              (!leader || !nonLeaders.includes(leader))
            ) {
              return true
            }
            return false
          })
        : allPosts

    return filterPosts(teamPosts, regularQuery)
  }, [allPosts, query, regularQuery, getLeadingTeamForSlug])

  const [indexToShow, setIndexToShow] = React.useState(initialIndexToShow)
  // when the query changes, we want to reset the index
  React.useEffect(() => {
    setIndexToShow(initialIndexToShow)
  }, [query])

  // this bit is very similar to what's on the blogs page.
  // Next time we need to do work in here, let's make an abstraction for them

  function toggleTag(tag: string) {
    setQuery(q => {
      // create a regexp so that we can replace multiple occurrences (`react node react`)
      const expression = new RegExp(tag, 'ig')

      const newQuery = expression.test(q)
        ? q.replace(expression, '')
        : `${q} ${tag}`

      // trim and remove subsequent spaces (`react   node ` => `react node`)
      return newQuery.replace(/\s+/g, ' ').trim()
    })
  }

  function toggleTeam(team: string) {
    team = team.toLowerCase()
    let newSpecialQuery = ''
    if (query.includes(`!leader:${team}`)) {
      newSpecialQuery = ''
    } else if (query.includes(`leader:${team}`)) {
      newSpecialQuery = `!leader:${team}`
    } else {
      newSpecialQuery = `leader:${team}`
    }
    setQuery(`${newSpecialQuery} ${regularQuery}`.trim())
  }

  const isSearching = query.length > 0

  const posts = isSearching
    ? matchingPosts.slice(0, indexToShow)
    : matchingPosts
        .slice(0, indexToShow)
        .filter(p => p.slug !== data.recommended?.slug)

  const hasMorePosts = isSearching
    ? indexToShow < matchingPosts.length
    : indexToShow < matchingPosts.length - 1

  const visibleTags = isSearching
    ? new Set(
        matchingPosts
          .flatMap(post => post.frontmatter.categories)
          .filter(Boolean),
      )
    : new Set(data.tags)

  const recommendedPermalink = data.recommended
    ? `${requestInfo.origin}/blog/${data.recommended.slug}`
    : undefined

  return (
    <div
      className={
        data.overallLeadingTeam
          ? `set-color-team-current-${data.overallLeadingTeam.toLowerCase()}`
          : ''
      }
    >
      <HeroSection
        title="Learn development with great articles."
        subtitle="Find the latest of my writing here."
        parallax={SkiParallax}
        action={
          <div className="w-full">
            <form
              action="/blog"
              method="GET"
              onSubmit={e => e.preventDefault()}
            >
              <div className="relative">
                <div className="absolute left-8 top-0 flex items-center justify-center h-full text-blueGray-500">
                  <SearchIcon />
                </div>
                <input
                  value={queryValue}
                  onChange={event =>
                    setQuery(event.currentTarget.value.toLowerCase())
                  }
                  name="q"
                  placeholder="Search blog"
                  aria-label="Search blog"
                  className="text-primary bg-primary border-secondary focus:bg-secondary px-16 py-6 w-full text-lg font-medium border hover:border-team-current focus:border-team-current rounded-full focus:outline-none"
                />
                <div className="absolute right-8 top-0 flex items-center justify-center h-full text-blueGray-500 text-lg font-medium">
                  {matchingPosts.length}
                </div>
              </div>
            </form>
          </div>
        }
      />

      <Grid className="mb-14">
        <div className="relative col-span-full h-20">
          <div className="absolute">
            <TeamStats
              totalReads={data.totalReads}
              rankings={data.readRankings}
              direction="down"
              onStatClick={toggleTeam}
            />
          </div>
        </div>

        <Spacer size="2xs" className="col-span-full" />

        <Paragraph className="col-span-full" prose={false}>
          {data.overallLeadingTeam ? (
            <>
              {`The `}
              <strong
                className={`text-team-current set-color-team-current-${data.overallLeadingTeam.toLowerCase()}`}
              >
                {data.overallLeadingTeam.toLowerCase()}
              </strong>
              {` team is in the lead. `}
              {userTeam === 'UNKNOWN' ? (
                <>
                  <Link to="/login" className="underlined">
                    Login or sign up
                  </Link>
                  {` to choose your team!`}
                </>
              ) : userTeam === data.overallLeadingTeam ? (
                `That's your team! Keep your lead!`
              ) : (
                <>
                  {`Keep reading to get the `}
                  <strong
                    className={`text-team-current set-color-team-current-${userTeam.toLowerCase()}`}
                  >
                    {userTeam.toLowerCase()}
                  </strong>{' '}
                  {` team on top!`}
                </>
              )}
            </>
          ) : (
            `No team is in the lead! Read read read!`
          )}
        </Paragraph>

        <Spacer size="xs" className="col-span-full" />

        {data.tags.length > 0 ? (
          <>
            <H6 as="div" className="col-span-full mb-6">
              Search blog by topics
            </H6>
            <div className="flex flex-wrap col-span-full -mb-4 -mr-4 lg:col-span-10">
              {data.tags.map(tag => {
                const selected = regularQuery.includes(tag)
                return (
                  <Tag
                    key={tag}
                    tag={tag}
                    selected={selected}
                    onClick={() => toggleTag(tag)}
                    disabled={!visibleTags.has(tag) && !selected}
                  />
                )
              })}
            </div>
          </>
        ) : null}
      </Grid>

      {!isSearching && data.recommended ? (
        <div className="mb-10">
          <FeaturedSection
            subTitle={
              data.recommended.frontmatter.date
                ? `${formatDate(data.recommended.frontmatter.date)} — ${
                    data.recommended.readTime?.text ?? 'quick read'
                  }`
                : 'TBA'
            }
            title={data.recommended.frontmatter.title}
            imageBuilder={
              data.recommended.frontmatter.bannerCloudinaryId
                ? getImageBuilder(
                    data.recommended.frontmatter.bannerCloudinaryId,
                    data.recommended.frontmatter.bannerAlt ??
                      data.recommended.frontmatter.bannerCredit ??
                      data.recommended.frontmatter.title ??
                      'Post banner',
                  )
                : undefined
            }
            caption="Featured article"
            cta="Read full article"
            slug={data.recommended.slug}
            permalink={recommendedPermalink}
            leadingTeam={getLeadingTeamForSlug(data.recommended.slug)}
          />
        </div>
      ) : null}

      <Grid className="mb-64">
        {posts.length === 0 ? (
          <div className="flex flex-col col-span-full items-center">
            <img
              className="mt-24 w-full max-w-lg h-auto"
              {...getImgProps(images.bustedOnewheel, {
                widths: [350, 512, 1024, 1536],
                sizes: ['(max-width: 639px) 80vw', '512px'],
              })}
            />
            <H3 variant="secondary" className="mt-24 max-w-lg">
              Looks like there are no articles for this topic. Use the tags
              above to find articles.
            </H3>
          </div>
        ) : (
          posts.map(article => (
            <div key={article.slug} className="col-span-4 mb-10">
              <ArticleCard
                article={article}
                leadingTeam={getLeadingTeamForSlug(article.slug)}
              />
            </div>
          ))
        )}
      </Grid>

      {hasMorePosts ? (
        <div className="flex justify-center mb-64 w-full">
          <Button
            variant="secondary"
            onClick={() => setIndexToShow(i => i + PAGE_SIZE)}
          >
            <span>Load more articles</span> <PlusIcon />
          </Button>
        </div>
      ) : null}

      <Grid>
        <div className="col-span-full lg:col-span-5">
          <img
            {...getImgProps(images.kayak, {
              widths: [350, 512, 1024, 1536],
              sizes: [
                '80vw',
                '(min-width: 1024px) 30vw',
                '(min-width:1620px) 530px',
              ],
            })}
          />
        </div>

        <div className="col-span-full mt-4 lg:col-span-6 lg:col-start-7 lg:mt-0">
          <H2 className="mb-8">{`More of a listener?`}</H2>
          <H2 className="mb-16" variant="secondary" as="p">
            {`
              Check out my podcast Chats with Kent and learn about software
              development, career, life, and more.
            `}
          </H2>
          <ArrowLink to="/chats">{`Check out the podcast`}</ArrowLink>
        </div>
      </Grid>
    </div>
  )
}

export default BlogHome

export function ErrorBoundary({error}: {error: Error}) {
  console.error(error)
  return <ServerError />
}
