export interface RegionCity {
  label: string
  value: string
}

export interface RegionProvince {
  label: string
  value: string
  cities: RegionCity[]
}

export interface RegionValue {
  province: string
  provinceLabel: string
  city: string
  cityLabel: string
}

export const regions: RegionProvince[] = [
  {
    label: '北京市',
    value: 'beijing',
    cities: [
      { label: '北京市', value: '39.9042,116.4074' },
    ],
  },
  {
    label: '上海市',
    value: 'shanghai',
    cities: [
      { label: '上海市', value: '31.2304,121.4737' },
    ],
  },
  {
    label: '天津市',
    value: 'tianjin',
    cities: [
      { label: '天津市', value: '39.0842,117.2009' },
    ],
  },
  {
    label: '重庆市',
    value: 'chongqing',
    cities: [
      { label: '重庆市', value: '29.5630,106.5516' },
    ],
  },
  {
    label: '湖南省',
    value: 'hunan',
    cities: [
      { label: '长沙市', value: '28.1894,112.9861' },
      { label: '株洲市', value: '27.8274,113.1339' },
      { label: '湘潭市', value: '27.8297,112.9441' },
      { label: '衡阳市', value: '26.8946,112.5719' },
      { label: '岳阳市', value: '29.3573,113.1292' },
      { label: '常德市', value: '29.0316,111.6985' },
      { label: '郴州市', value: '25.7706,113.0147' },
    ],
  },
  {
    label: '广东省',
    value: 'guangdong',
    cities: [
      { label: '广州市', value: '23.1291,113.2644' },
      { label: '深圳市', value: '22.5431,114.0579' },
      { label: '珠海市', value: '22.2710,113.5767' },
      { label: '佛山市', value: '23.0215,113.1214' },
      { label: '东莞市', value: '23.0207,113.7518' },
      { label: '中山市', value: '22.5176,113.3928' },
      { label: '惠州市', value: '23.1115,114.4168' },
      { label: '汕头市', value: '23.3541,116.6819' },
    ],
  },
  {
    label: '浙江省',
    value: 'zhejiang',
    cities: [
      { label: '杭州市', value: '30.2741,120.1551' },
      { label: '宁波市', value: '29.8683,121.5440' },
      { label: '温州市', value: '27.9949,120.6994' },
      { label: '绍兴市', value: '30.0303,120.5802' },
      { label: '嘉兴市', value: '30.7461,120.7555' },
      { label: '金华市', value: '29.0792,119.6474' },
      { label: '台州市', value: '28.6564,121.4208' },
    ],
  },
  {
    label: '江苏省',
    value: 'jiangsu',
    cities: [
      { label: '南京市', value: '32.0603,118.7969' },
      { label: '苏州市', value: '31.2989,120.5853' },
      { label: '无锡市', value: '31.4912,120.3119' },
      { label: '常州市', value: '31.8107,119.9741' },
      { label: '南通市', value: '31.9802,120.8943' },
      { label: '徐州市', value: '34.2058,117.2858' },
      { label: '扬州市', value: '32.3932,119.4127' },
    ],
  },
  {
    label: '福建省',
    value: 'fujian',
    cities: [
      { label: '福州市', value: '26.0745,119.2965' },
      { label: '厦门市', value: '24.4798,118.0894' },
      { label: '泉州市', value: '24.8741,118.6757' },
      { label: '漳州市', value: '24.5133,117.6472' },
    ],
  },
  {
    label: '山东省',
    value: 'shandong',
    cities: [
      { label: '济南市', value: '36.6512,117.1201' },
      { label: '青岛市', value: '36.0671,120.3826' },
      { label: '烟台市', value: '37.4638,121.4479' },
      { label: '潍坊市', value: '36.7069,119.1618' },
      { label: '临沂市', value: '35.1041,118.3564' },
    ],
  },
  {
    label: '河南省',
    value: 'henan',
    cities: [
      { label: '郑州市', value: '34.7473,113.6249' },
      { label: '洛阳市', value: '34.6197,112.4540' },
      { label: '开封市', value: '34.7973,114.3076' },
      { label: '南阳市', value: '32.9991,112.5283' },
      { label: '新乡市', value: '35.3026,113.9268' },
    ],
  },
  {
    label: '湖北省',
    value: 'hubei',
    cities: [
      { label: '武汉市', value: '30.5928,114.3055' },
      { label: '宜昌市', value: '30.6919,111.2865' },
      { label: '襄阳市', value: '32.0090,112.1226' },
      { label: '荆州市', value: '30.3348,112.2407' },
    ],
  },
  {
    label: '四川省',
    value: 'sichuan',
    cities: [
      { label: '成都市', value: '30.5728,104.0668' },
      { label: '绵阳市', value: '31.4675,104.6796' },
      { label: '德阳市', value: '31.1280,104.3979' },
      { label: '南充市', value: '30.8373,106.1107' },
    ],
  },
  {
    label: '陕西省',
    value: 'shaanxi',
    cities: [
      { label: '西安市', value: '34.3416,108.9398' },
      { label: '咸阳市', value: '34.3296,108.7093' },
      { label: '宝鸡市', value: '34.3619,107.2373' },
    ],
  },
  {
    label: '河北省',
    value: 'hebei',
    cities: [
      { label: '石家庄市', value: '38.0428,114.5149' },
      { label: '唐山市', value: '39.6305,118.1802' },
      { label: '保定市', value: '38.8743,115.4646' },
      { label: '廊坊市', value: '39.5377,116.6838' },
    ],
  },
  {
    label: '辽宁省',
    value: 'liaoning',
    cities: [
      { label: '沈阳市', value: '41.8057,123.4315' },
      { label: '大连市', value: '38.9140,121.6147' },
      { label: '鞍山市', value: '41.1078,122.9946' },
    ],
  },
  {
    label: '吉林省',
    value: 'jilin',
    cities: [
      { label: '长春市', value: '43.8171,125.3235' },
      { label: '吉林市', value: '43.8378,126.5494' },
    ],
  },
  {
    label: '黑龙江省',
    value: 'heilongjiang',
    cities: [
      { label: '哈尔滨市', value: '45.8038,126.5349' },
      { label: '齐齐哈尔市', value: '47.3543,123.9182' },
    ],
  },
  {
    label: '安徽省',
    value: 'anhui',
    cities: [
      { label: '合肥市', value: '31.8206,117.2290' },
      { label: '芜湖市', value: '31.3525,118.4331' },
      { label: '蚌埠市', value: '32.9160,117.3897' },
    ],
  },
  {
    label: '江西省',
    value: 'jiangxi',
    cities: [
      { label: '南昌市', value: '28.6820,115.8582' },
      { label: '赣州市', value: '25.8310,114.9359' },
      { label: '九江市', value: '29.7051,116.0019' },
    ],
  },
  {
    label: '山西省',
    value: 'shanxi',
    cities: [
      { label: '太原市', value: '37.8706,112.5489' },
      { label: '大同市', value: '40.0768,113.3001' },
      { label: '运城市', value: '35.0264,111.0076' },
    ],
  },
  {
    label: '内蒙古自治区',
    value: 'neimenggu',
    cities: [
      { label: '呼和浩特市', value: '40.8427,111.7492' },
      { label: '包头市', value: '40.6574,109.8403' },
      { label: '鄂尔多斯市', value: '39.6086,109.7813' },
    ],
  },
  {
    label: '广西壮族自治区',
    value: 'guangxi',
    cities: [
      { label: '南宁市', value: '22.8170,108.3669' },
      { label: '桂林市', value: '25.2736,110.2900' },
      { label: '柳州市', value: '24.3255,109.4286' },
    ],
  },
  {
    label: '海南省',
    value: 'hainan',
    cities: [
      { label: '海口市', value: '20.0440,110.1983' },
      { label: '三亚市', value: '18.2528,109.5119' },
    ],
  },
  {
    label: '贵州省',
    value: 'guizhou',
    cities: [
      { label: '贵阳市', value: '26.6470,106.6302' },
      { label: '遵义市', value: '27.7257,106.9272' },
    ],
  },
  {
    label: '云南省',
    value: 'yunnan',
    cities: [
      { label: '昆明市', value: '25.0389,102.7183' },
      { label: '曲靖市', value: '25.4900,103.7979' },
      { label: '大理市', value: '25.6075,100.2676' },
    ],
  },
  {
    label: '甘肃省',
    value: 'gansu',
    cities: [
      { label: '兰州市', value: '36.0611,103.8343' },
      { label: '天水市', value: '34.5809,105.7249' },
    ],
  },
  {
    label: '青海省',
    value: 'qinghai',
    cities: [
      { label: '西宁市', value: '36.6171,101.7782' },
    ],
  },
  {
    label: '宁夏回族自治区',
    value: 'ningxia',
    cities: [
      { label: '银川市', value: '38.4872,106.2309' },
    ],
  },
  {
    label: '新疆维吾尔自治区',
    value: 'xinjiang',
    cities: [
      { label: '乌鲁木齐市', value: '43.8256,87.6168' },
      { label: '喀什市', value: '39.4677,75.9898' },
    ],
  },
  {
    label: '西藏自治区',
    value: 'xizang',
    cities: [
      { label: '拉萨市', value: '29.6520,91.1721' },
    ],
  },
] as const