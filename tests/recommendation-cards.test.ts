import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import RecommendationCards from "../app/components/RecommendationCards";
import type { Recommendation } from "../types";

test("an empty route list renders a safe unavailable state", () => {
  const runtime = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = runtime.React;
  runtime.React = React;
  const malformedRecommendation: Recommendation = {
    poi: {
      name: "测试餐厅",
      address: "测试地址",
      location: "114.100000,22.620000",
      distance: "1000",
      tel: "",
      type: "餐饮服务;中餐厅",
      rating: "4.5",
    },
    routes: [],
    totalDuration: 0,
    maxDuration: Number.NEGATIVE_INFINITY,
  };

  try {
    const html = renderToStaticMarkup(
      React.createElement(RecommendationCards, {
        recommendations: [malformedRecommendation],
      })
    );

    assert.match(html, /路线暂不可用/);
    assert.equal(html.includes("Infinity"), false);
    assert.equal(html.includes("NaN"), false);
  } finally {
    if (previousReact === undefined) delete runtime.React;
    else runtime.React = previousReact;
  }
});
