import React from 'react';
import { renderToString } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import WealthRoutes from '../src/wealth-routes';
import { getWealthPost, getWealthSeoMeta } from '../src/lib/wealth';

function getHeadElements(url) {
  if (!url.startsWith('/wealth')) {
    return undefined;
  }

  const slug = url
    .replace(/^\/wealth\/?/, '')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '');

  const post = slug ? getWealthPost(slug) : null;
  const seoMeta = getWealthSeoMeta(post);
  const elements = [
    {
      type: 'meta',
      props: {
        name: 'prerender-static-page',
        content: 'wealth',
      },
    },
    seoMeta.url
      ? {
          type: 'link',
          props: {
            rel: 'canonical',
            href: seoMeta.url,
          },
        }
      : null,
    {
      type: 'meta',
      props: {
        name: 'description',
        content: seoMeta.description,
      },
    },
    seoMeta.keywords
      ? {
          type: 'meta',
          props: {
            name: 'keywords',
            content: seoMeta.keywords,
          },
        }
      : null,
    seoMeta.url
      ? {
          type: 'meta',
          props: {
            property: 'og:url',
            content: seoMeta.url,
          },
        }
      : null,
    {
      type: 'meta',
      props: {
        property: 'og:title',
        content: seoMeta.ogTitle,
      },
    },
    {
      type: 'meta',
      props: {
        property: 'og:description',
        content: seoMeta.ogDescription,
      },
    },
    {
      type: 'meta',
      props: {
        property: 'og:site_name',
        content: seoMeta.siteName,
      },
    },
    seoMeta.ogImage
      ? {
          type: 'meta',
          props: {
            property: 'og:image',
            content: seoMeta.ogImage,
          },
        }
      : null,
    seoMeta.ogImageAlt
      ? {
          type: 'meta',
          props: {
            property: 'og:image:alt',
            content: seoMeta.ogImageAlt,
          },
        }
      : null,
    seoMeta.publishedTime
      ? {
          type: 'meta',
          props: {
            property: 'article:published_time',
            content: seoMeta.publishedTime,
          },
        }
      : null,
    ...(seoMeta.tags ?? []).map((tag) => ({
      type: 'meta',
      props: {
        property: 'article:tag',
        content: tag,
      },
    })),
  ].filter(Boolean);

  return {
    title: seoMeta.title,
    lang: seoMeta.lang,
    elements: new Set(elements),
  };
}

export async function prerender({ url }) {
  const html = renderToString(
    React.createElement(
      StaticRouter,
      { location: url },
      React.createElement(
        Routes,
        null,
        React.createElement(
          Route,
          { path: '/wealth/*', element: React.createElement(WealthRoutes) },
        ),
      ),
    ),
  );

  const slug = url
    .replace(/^\/wealth\/?/, '')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '');
  const is404 = slug && !getWealthPost(slug);

  return {
    html,
    head: getHeadElements(url),
    ...(is404 ? { statusCode: 404 } : {}),
  };
}
