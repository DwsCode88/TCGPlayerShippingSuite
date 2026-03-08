export type EasyPostRate = {
  id: string;
  carrier: string;
  service: string;
  rate: string;
};

export type EasyPostPostageLabel = {
  label_url: string;
};

export type EasyPostTracker = {
  public_url: string;
};

export type EasyPostShipment = {
  id: string;
  rates: EasyPostRate[];
  error?: string;
};

export type EasyPostBoughtShipment = {
  tracking_code: string;
  postage_label?: EasyPostPostageLabel;
  tracker?: EasyPostTracker;
  error?: string;
};
