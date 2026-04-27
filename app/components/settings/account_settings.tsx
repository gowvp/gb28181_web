import { useMutation } from "@tanstack/react-query";
import { Button, Form, Input, Popconfirm } from "antd";
import { useNavigate } from "react-router";
import { toastSuccess } from "~/components/xui/toast";
import { PUT } from "~/service/config/http";
import { ErrorHandle } from "~/service/config/error";
import { getPublicKey } from "~/service/api/user/user";

interface UpdateCredentialsResponse {
  msg: string;
}

/** 使用动态导入加载 node-forge 进行 RSA-OAEP 加密 */
async function encryptWithRSA(
  publicKeyPem: string,
  data: string,
): Promise<string> {
  const forge = (await import("node-forge")).default;
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(data, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
  return forge.util.encode64(encrypted);
}

/** 修改账户凭据，旧密码+新账号+新密码一起加密传输 */
async function updateCredentials(data: {
  username: string;
  old_password: string;
  password: string;
}): Promise<UpdateCredentialsResponse> {
  const { key: base64PemKey } = await getPublicKey();
  const pemKey = atob(base64PemKey);
  const encrypted = await encryptWithRSA(pemKey, JSON.stringify(data));
  const res = await PUT<UpdateCredentialsResponse>("/users", { data: encrypted });
  return res.data;
}

/**
 * 账户设置面板
 * 为什么提交后清 token 并跳登录：凭据变更后旧 JWT 语义上已失效，
 * 强制重新登录避免后续请求带过期身份。
 */
export default function AccountSettings({ onClose }: { onClose: () => void }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateCredentials,
    onError: ErrorHandle,
    onSuccess: () => {
      toastSuccess("凭据更新成功");
      localStorage.removeItem("GOWVP_TOKEN");
      localStorage.removeItem("user");
      onClose();
      navigate("/");
    },
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { confirmPassword: _, ...payload } = values;
      await mutateAsync(payload);
    } catch {
      // 表单验证未通过
    }
  };

  return (
    <div className="max-w-sm">
      <h3 className="text-base font-medium mb-4">账户设置</h3>
      <Form form={form} layout="vertical" size="large">
        <Form.Item
          label="账号"
          name="username"
          rules={[{ required: true, message: "请输入账号" }]}
        >
          <Input placeholder="请输入新账号" />
        </Form.Item>

        <Form.Item
          label="旧密码"
          name="old_password"
          rules={[{ required: true, message: "请输入旧密码" }]}
        >
          <Input.Password placeholder="请输入当前密码" />
        </Form.Item>

        <Form.Item
          label="新密码"
          name="password"
          rules={[{ required: true, message: "请输入新密码" }]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>

        <Form.Item
          label="确认密码"
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请确认密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入密码" />
        </Form.Item>

        <Popconfirm
          title="确认修改"
          description="修改账户信息后将自动退出登录，需要使用新凭据重新登录。"
          okText="确认"
          cancelText="取消"
          onConfirm={handleSubmit}
        >
          <Button
            type="primary"
            loading={isPending}
            className="mt-2 w-1/2"
          >
            提交
          </Button>
        </Popconfirm>
      </Form>
    </div>
  );
}
