import { useMutation } from "@tanstack/react-query";
import type { FormInstance } from "antd";
import { Button, Form, Modal } from "antd";
import { SquarePlus } from "lucide-react";
import React, {
  Children,
  isValidElement,
  useImperativeHandle,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button as ShadcnButton } from "~/components/ui/button";
import { ErrorHandle } from "~/service/config/error";

export interface PFormProps {
  onAddSuccess?: () => void; // 添加成功回调
  onEditSuccess?: (data: any) => void; // 编辑成功回调
  ref: React.RefObject<EditSheetImpl | null>; // 控制反转
}

// 步骤配置
export interface StepConfig {
  title: string; // 步骤标题
  fields: string[]; // 该步骤包含的字段名
}

interface EditSheetProps {
  title: string; // 标题
  description?: string; // 描述
  children: React.ReactNode; // 表单内容
  trigger?: React.ReactNode; // 触发器按钮
  mutation: {
    // api 请求
    add: (values: any) => Promise<any>;
    edit: (id: string, values: any) => Promise<any>;
  };
  onSuccess?: {
    // 成功回调
    add?: () => void;
    edit?: (data: any) => void;
  };
  ref?: React.Ref<EditSheetImpl>;
  form: FormInstance; // Ant Design Form 实例
  width?: number | string; // Modal 宽度，默认 520
  steps?: StepConfig[]; // 步骤配置，如果不提供则自动分组
  fieldsPerStep?: number; // 每步字段数，默认 2
}

export interface EditSheetImpl {
  edit: (values: any) => void; // 编辑时传入表单的值，打开弹窗
}

/**
 * 统一的多步骤表单编辑弹窗组件
 * 支持新增和编辑两种模式，通过 form 中是否有 id 字段区分
 * 自动将表单字段按每 3 个分组为一个步骤
 */
export function EditSheet({
  title,
  description,
  children,
  trigger,
  mutation,
  onSuccess,
  ref,
  form,
  width = 520,
  steps: customSteps,
  fieldsPerStep = 2,
}: EditSheetProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // 解析 children 中的 Form.Item，提取字段信息
  const parseFormItems = () => {
    const items: { name: string; element: React.ReactNode; hidden: boolean }[] =
      [];

    const traverse = (node: React.ReactNode) => {
      Children.forEach(node, (child) => {
        if (isValidElement(child)) {
          // 检查是否是 Form.Item
          if (
            child.type === Form.Item ||
            (child.type as any)?.displayName === "FormItem"
          ) {
            const props = child.props as any;
            const name = props.name;
            const hidden = props.hidden === true;

            if (name) {
              items.push({ name, element: child, hidden });
            }
          }
          // 递归处理子元素
          if ((child.props as { children?: React.ReactNode })?.children) {
            traverse((child.props as { children?: React.ReactNode }).children);
          }
        }
      });
    };

    traverse(children);
    return items;
  };

  const formItems = parseFormItems();

  // 过滤出可见的表单项（用于分步）
  const visibleItems = formItems.filter((item) => !item.hidden);
  // 隐藏的表单项（始终渲染）
  const hiddenItems = formItems.filter((item) => item.hidden);

  // 自动生成步骤配置（每步 fieldsPerStep 个字段，最多 3 步）
  const generateSteps = (): StepConfig[] => {
    if (customSteps) return customSteps;

    const stepsConfig: StepConfig[] = [];
    const totalItems = visibleItems.length;

    // 按 fieldsPerStep 分组，最多 3 步
    for (
      let i = 0;
      i < totalItems && stepsConfig.length < 3;
      i += fieldsPerStep
    ) {
      const stepItems = visibleItems.slice(i, i + fieldsPerStep);
      stepsConfig.push({
        title: `${t("step")} ${stepsConfig.length + 1}`,
        fields: stepItems.map((item) => item.name),
      });
    }

    return stepsConfig;
  };

  const stepsConfig = generateSteps();
  const totalSteps = stepsConfig.length;
  const isMultiStep = totalSteps > 1;

  // 获取当前步骤应该显示的字段
  const getCurrentStepFields = (): string[] => {
    if (!isMultiStep) return visibleItems.map((item) => item.name);
    return stepsConfig[currentStep]?.fields || [];
  };

  // 判断当前是编辑模式还是新增模式
  const isEditMode = () => {
    const values = form.getFieldsValue();
    return !!values.id;
  };

  useImperativeHandle(ref, () => ({
    edit(values: any) {
      console.log("🚀 ~ edit ~ values:", values);
      form.setFieldsValue(values);
      setCurrentStep(0);
      setOpen(true);
    },
  }));

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (values: any) => {
      if (values.id) {
        return await mutation.edit(values.id, values);
      }
      return await mutation.add(values);
    },
    onSuccess(data, variables) {
      if (variables.id) {
        onSuccess?.edit?.(data.data);
      } else {
        onSuccess?.add?.();
      }
      handleClose();
    },
    onError: ErrorHandle,
  });

  // 验证当前步骤的字段
  const validateCurrentStep = async (): Promise<boolean> => {
    const currentFields = getCurrentStepFields();
    try {
      await form.validateFields(currentFields);
      return true;
    } catch {
      return false;
    }
  };

  // 下一步
  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // 最后一步时验证所有字段
      const values = await form.validateFields();
      await mutateAsync(values);
    } catch (error) {
      console.log("表单验证失败:", error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentStep(0);
    // 延迟重置表单，避免关闭动画时内容闪烁
    setTimeout(() => {
      form.resetFields();
    }, 200);
  };

  const handleCancel = () => {
    handleClose();
  };

  // 打开弹窗（用于新增模式）
  const handleOpen = () => {
    form.resetFields();
    setCurrentStep(0);
    setOpen(true);
  };

  // 渲染触发按钮
  const renderTrigger = () => {
    if (trigger === null) {
      return null;
    }

    const defaultTrigger = (
      <ShadcnButton onClick={handleOpen}>
        <SquarePlus className="mr-2 h-4 w-4" />
        {t("add")}
      </ShadcnButton>
    );

    if (trigger) {
      if (React.isValidElement(trigger)) {
        return React.cloneElement(trigger as React.ReactElement<any>, {
          onClick: (e: React.MouseEvent) => {
            const originalOnClick = (trigger as React.ReactElement<any>).props
              ?.onClick;
            if (originalOnClick) {
              originalOnClick(e);
            }
            handleOpen();
          },
        });
      }
      return (
        <div
          onClick={handleOpen}
          style={{ display: "inline-block", cursor: "pointer" }}
        >
          {trigger}
        </div>
      );
    }

    return defaultTrigger;
  };

  // 渲染表单内容
  const renderFormContent = () => {
    const currentFields = getCurrentStepFields();

    return (
      <>
        {/* 隐藏字段始终渲染 */}
        {hiddenItems.map((item) => (
          <div key={item.name} style={{ display: "none" }}>
            {item.element}
          </div>
        ))}

        {/* 可见字段根据当前步骤显示/隐藏 */}
        {visibleItems.map((item) => {
          const isCurrentStep = currentFields.includes(item.name);
          return (
            <div
              key={item.name}
              style={{ display: isCurrentStep ? "block" : "none" }}
            >
              {item.element}
            </div>
          );
        })}
      </>
    );
  };

  // 渲染底部按钮
  const renderFooter = () => {
    if (!isMultiStep) {
      return [
        <Button key="cancel" size="middle" onClick={handleCancel}>
          {t("cancel")}
        </Button>,
        <Button
          key="submit"
          size="middle"
          type="primary"
          loading={isPending}
          onClick={handleSubmit}
        >
          {isEditMode() ? t("save") : t("add")}
        </Button>,
      ];
    }

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === totalSteps - 1;

    return [
      !isFirstStep && (
        <Button key="prev" size="middle" onClick={handlePrev}>
          {t("prev_step")}
        </Button>
      ),
      isLastStep ? (
        <Button
          key="submit"
          size="middle"
          type="primary"
          loading={isPending}
          onClick={handleSubmit}
        >
          {isEditMode() ? t("save") : t("add")}
        </Button>
      ) : (
        <Button key="next" size="middle" type="primary" onClick={handleNext}>
          {t("next_step")}
        </Button>
      ),
    ].filter(Boolean);
  };

  return (
    <>
      {renderTrigger()}

      <Modal
        title={title}
        open={open}
        onCancel={handleCancel}
        width={width}
        footer={renderFooter()}
        destroyOnHidden={false}
        maskClosable={false}
      >
        {description && (
          <p className="text-gray-500 text-sm mb-4">{description}</p>
        )}

        <Form form={form} layout="vertical" className="[&_.ant-form-item]:mb-3">
          {renderFormContent()}
        </Form>
      </Modal>
    </>
  );
}
