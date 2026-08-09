import { Participant, Recommendation } from "@/types";

export interface DemoPreset {
  id: string;
  label: string;
  eyebrow: string;
  userMessage: string;
  assistantMessage: string;
  participants: Participant[];
  centerPoint: string;
  recommendations: Recommendation[];
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "suzhou-hotpot",
    label: "苏州双人火锅",
    eyebrow: "无需 API · 示例数据",
    userMessage: "我住观前街，小明住阳澄湖，想吃火锅",
    assistantMessage:
      "🎯 示例场景已加载。Centro 以最慢到达者的通勤时间为公平性指标，筛出了 3 个更均衡的火锅选择。你也可以输入自己的真实聚会需求进行在线搜索。",
    participants: [
      { name: "我", address: "苏州观前街", location: "120.623550,31.314130" },
      {
        name: "小明",
        address: "苏州阳澄湖半岛",
        location: "120.837240,31.385620",
      },
    ],
    centerPoint: "120.730395,31.349875",
    recommendations: [
      {
        poi: {
          name: "黔味地摊火锅",
          address: "苏州工业园区跨南路 2 号大丰收广场",
          location: "120.738120,31.335640",
          distance: "1760",
          tel: "18913208006",
          type: "餐饮服务;中餐厅;火锅店",
          rating: "4.6",
        },
        routes: [
          {
            participantName: "我",
            duration_min: 41,
            distance_km: 9.4,
            transportMode: "公交/地铁",
          },
          {
            participantName: "小明",
            duration_min: 29,
            distance_km: 13.8,
            transportMode: "公交/地铁",
          },
        ],
        totalDuration: 70,
        maxDuration: 41,
      },
      {
        poi: {
          name: "李姐社区火锅",
          address: "苏州工业园区唯和路 35 号青剑湖商业中心",
          location: "120.753810,31.365290",
          distance: "2950",
          tel: "18068082333",
          type: "餐饮服务;中餐厅;火锅店",
          rating: "4.5",
        },
        routes: [
          {
            participantName: "我",
            duration_min: 49,
            distance_km: 12.3,
            transportMode: "公交/地铁",
          },
          {
            participantName: "小明",
            duration_min: 22,
            distance_km: 11.3,
            transportMode: "公交/地铁",
          },
        ],
        totalDuration: 71,
        maxDuration: 49,
      },
      {
        poi: {
          name: "刘记潮汕牛肉火锅",
          address: "苏州工业园区星湖街邻里中心",
          location: "120.718760,31.327410",
          distance: "2630",
          tel: "",
          type: "餐饮服务;中餐厅;火锅店",
          rating: "4.3",
        },
        routes: [
          {
            participantName: "我",
            duration_min: 46,
            distance_km: 8.8,
            transportMode: "公交/地铁",
          },
          {
            participantName: "小明",
            duration_min: 51,
            distance_km: 15.2,
            transportMode: "驾车",
          },
        ],
        totalDuration: 97,
        maxDuration: 51,
      },
    ],
  },
];
