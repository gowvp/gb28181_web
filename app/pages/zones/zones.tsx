import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { COLOR_POOL } from "~/components/zone_editor/constants";
import PolygonZoneEditor, {
  type ZoneData,
} from "~/components/zone_editor/polygon_zone_editor";
import {
  AddZone,
  GetZones,
  getZonesKey,
  Play,
  RefreshSnapshot,
} from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/config/error";

/**
 * 区域设置页面
 * 参考 frigate 的交互设计：
 * - 点击添加进入编辑模式，创建空区域
 * - 用户在画布上点击添加点
 * - 点击第一个点闭合区域，自动退出编辑模式
 * - 需要手动点击保存才发送 API 请求
 * - 左侧显示区域详情：name、点位数量、重置按钮
 * - 区域列表每项有编辑和删除图标
 */
export default function ZonesPage() {
  const { t } = useTranslation("common");
  const _navigate = useNavigate();
  const queryClient = useQueryClient();

  // 从 URL 获取 cid 参数
  const channelId =
    new URLSearchParams(window.location.search).get("cid") || "";

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number | undefined>();
  const [isEditing, setIsEditing] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState("");

  // 获取播放地址（用于刷新快照）
  const { data: playData } = useQuery({
    queryKey: ["play", channelId],
    queryFn: () => Play(channelId),
    enabled: !!channelId,
  });

  // 获取/刷新快照
  const { mutate: refreshSnapshotMutate } = useMutation({
    mutationFn: () => {
      const rtspUrl = playData?.data?.items?.[0]?.rtsp || "";
      return RefreshSnapshot(channelId, rtspUrl, 300);
    },
    onSuccess: (data) => {
      if (data.data?.link) {
        setSnapshotUrl(data.data.link);
      }
    },
    onError: ErrorHandle,
  });

  // 获取已有区域
  const { data: zonesData } = useQuery({
    queryKey: [getZonesKey, channelId],
    queryFn: () => GetZones(channelId),
    enabled: !!channelId,
  });

  // 添加区域
  const { mutate: addZoneMutate, isPending: isAdding } = useMutation({
    mutationFn: (zone: {
      name: string;
      coordinates: number[];
      color: string;
    }) => AddZone(channelId, zone),
    onSuccess: () => {
      toast.success(t("save_success"));
      queryClient.invalidateQueries({ queryKey: [getZonesKey, channelId] });
    },
    onError: ErrorHandle,
  });

  // 初始化加载快照
  useEffect(() => {
    if (playData?.data?.items?.[0]?.rtsp) {
      refreshSnapshotMutate();
    }
  }, [playData, refreshSnapshotMutate]);

  // 加载已有区域
  useEffect(() => {
    if (zonesData?.data) {
      const loadedZones: ZoneData[] = zonesData.data.map((zone, index) => ({
        name: zone.name,
        points: zone.coordinates,
        color: zone.color || COLOR_POOL[index % COLOR_POOL.length],
        isFinished: true,
      }));
      setZones(loadedZones);
    }
  }, [zonesData]);

  // 处理区域数据变更
  const handleZonesChange = useCallback((newZones: ZoneData[]) => {
    setZones(newZones);
  }, []);

  // 处理区域选中
  const handleZoneSelect = useCallback((index: number | undefined) => {
    setActiveZoneIndex(index);
  }, []);

  // 区域闭合回调 - 自动退出编辑模式
  const handleZoneFinished = useCallback((index: number) => {
    setIsEditing(false);
    setActiveZoneIndex(index);
  }, []);

  // 更新区域名称
  const handleNameChange = useCallback(
    (name: string) => {
      if (activeZoneIndex !== undefined) {
        setZones((prev) => {
          const newZones = [...prev];
          if (newZones[activeZoneIndex]) {
            newZones[activeZoneIndex] = {
              ...newZones[activeZoneIndex],
              name,
            };
          }
          return newZones;
        });
      }
    },
    [activeZoneIndex],
  );

  // 删除区域
  const handleDeleteZone = useCallback(
    (index: number) => {
      setZones((prev) => prev.filter((_, i) => i !== index));
      if (activeZoneIndex === index) {
        setActiveZoneIndex(undefined);
        setIsEditing(false);
      } else if (activeZoneIndex !== undefined && activeZoneIndex > index) {
        setActiveZoneIndex(activeZoneIndex - 1);
      }
    },
    [activeZoneIndex],
  );

  // 添加新区域 - 进入编辑模式
  const handleAddZone = useCallback(() => {
    // 如果当前有未完成的区域，不允许创建新区域
    if (zones.some((z) => !z.isFinished)) {
      toast.warning(t("zone_not_closed"));
      return;
    }

    // 创建新的空区域
    const newZone: ZoneData = {
      name: `zone_${zones.length + 1}`,
      points: [],
      color: COLOR_POOL[zones.length % COLOR_POOL.length],
      isFinished: false,
    };

    const newZones = [...zones, newZone];
    setZones(newZones);
    setActiveZoneIndex(newZones.length - 1);
    setIsEditing(true);
  }, [zones, t]);

  // 编辑区域 - 进入编辑模式（可拖拽调整顶点）
  const handleEditZone = useCallback((index: number) => {
    setActiveZoneIndex(index);
    setIsEditing(true);
  }, []);

  // 重置区域点位 - 清空当前区域的点位重新绘制
  const handleResetPoints = useCallback(() => {
    if (activeZoneIndex === undefined) return;

    setZones((prev) => {
      const newZones = [...prev];
      if (newZones[activeZoneIndex]) {
        newZones[activeZoneIndex] = {
          ...newZones[activeZoneIndex],
          points: [],
          isFinished: false,
        };
      }
      return newZones;
    });
    setIsEditing(true);
  }, [activeZoneIndex]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    if (activeZoneIndex !== undefined) {
      const zone = zones[activeZoneIndex];
      // 如果是新建的空区域，删除它
      if (zone && zone.points.length === 0) {
        setZones((prev) => prev.filter((_, i) => i !== activeZoneIndex));
      }
    }
    setActiveZoneIndex(undefined);
    setIsEditing(false);
  }, [activeZoneIndex, zones]);

  // 保存区域
  const handleSaveZone = useCallback(() => {
    if (activeZoneIndex === undefined) return;

    const zone = zones[activeZoneIndex];
    if (!zone || !zone.isFinished) {
      toast.error(t("zone_not_closed"));
      return;
    }

    if (!zone.name || zone.name.length < 2) {
      toast.error(t("zone_name_required"));
      return;
    }

    addZoneMutate({
      name: zone.name,
      coordinates: zone.points,
      color: zone.color,
    });
  }, [activeZoneIndex, zones, addZoneMutate, t]);

  // 返回上一页
  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  // 当前选中的区域
  const activeZone =
    activeZoneIndex !== undefined ? zones[activeZoneIndex] : null;
  const pointCount = activeZone ? activeZone.points.length / 2 : 0;

  return (
    <div className="flex h-full w-full flex-col md:flex-row bg-gray-50">
      {/* 左侧面板 */}
      <div className="w-full md:w-80 border-r bg-white p-4 overflow-y-auto">
        {/* 标题和返回 */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">{t("zone_settings")}</h1>
        </div>

        <Separator className="mb-4" />

        {/* 区域编辑面板 - 仅当选中区域时显示 */}
        {activeZone ? (
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{t("edit_zone")}</h3>
              {activeZone.isFinished && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✓ {t("closed")}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {t("zone_edit_desc")}
            </p>

            {/* 点数信息和重置按钮 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">
                {pointCount} {t("points")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetPoints}
                title={t("reset_points")}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {t("reset")}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {isEditing ? t("zone_click_tip") : t("zone_edit_drag_tip")}
            </p>

            {/* 区域名称 */}
            <div>
              <label className="text-sm font-medium">{t("zone_name")}</label>
              <Input
                className="mt-1"
                value={activeZone.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("zone_name_placeholder")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("zone_name_tip")}
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelEdit}
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveZone}
                disabled={!activeZone.isFinished || isAdding}
              >
                {t("save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 mb-4">
            <p className="text-muted-foreground mb-4">{t("zone_select_tip")}</p>
            <Button onClick={handleAddZone}>
              <Plus className="w-4 h-4 mr-1" />
              {t("add_zone")}
            </Button>
          </div>
        )}

        <Separator className="my-4" />

        {/* 区域列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{t("zones")}</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddZone}
              disabled={zones.some((z) => !z.isFinished)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {zones.map((zone, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                  index === activeZoneIndex
                    ? "bg-primary/10 border border-primary"
                    : "hover:bg-gray-100 border border-transparent"
                }`}
              >
                {/* 颜色标识 */}
                <div
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: zone.color }}
                />

                {/* 区域名称 */}
                <span
                  className="flex-1 text-sm truncate cursor-pointer"
                  onClick={() => setActiveZoneIndex(index)}
                >
                  {zone.name || `Zone ${index + 1}`}
                </span>

                {/* 绘制中标识 */}
                {!zone.isFinished && (
                  <span className="text-xs text-orange-500 shrink-0">
                    {t("drawing")}
                  </span>
                )}

                {/* 编辑按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleEditZone(index)}
                  title={t("edit")}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteZone(index)}
                  title={t("delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            {zones.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("no_zones")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 右侧画布区域 */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-[400px]">
        <PolygonZoneEditor
          imageUrl={snapshotUrl}
          initialZones={zones}
          activeZoneIndex={activeZoneIndex}
          isEditing={isEditing}
          onZonesChange={handleZonesChange}
          onZoneSelect={handleZoneSelect}
          onZoneFinished={handleZoneFinished}
        />
      </div>
    </div>
  );
}
