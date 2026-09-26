import { useMutation } from "@tanstack/react-query";
import { Popconfirm } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppleInput } from "~/components/xui/apple_input";
import { toastSuccess, toastWarn } from "~/components/xui/toast";
import { PUT } from "~/service/config/http";
import { ErrorHandle } from "~/service/config/error";
import { getPublicKey, getUserInfo, logout } from "~/service/api/user/user";

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
 * 采用与其它弹窗统一的原生表单与 AppleInput 组件结构，
 * 消除 Antd Form.Item 的额外占位，保持视觉层级与边框表现 100% 相同。
 */
export default function AccountSettings({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => getUserInfo()?.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateCredentials,
    onError: ErrorHandle,
    onSuccess: () => {
      toastSuccess("凭据更新成功");
      logout();
      onClose();
      navigate("/");
    },
  });

  const handleConfirmSubmit = async () => {
    if (!username.trim()) {
      toastWarn("请输入账号");
      return;
    }
    if (!oldPassword) {
      toastWarn("请输入旧密码");
      return;
    }
    if (!password) {
      toastWarn("请输入新密码");
      return;
    }
    if (password !== confirmPassword) {
      toastWarn("两次输入的密码不一致");
      return;
    }

    await mutateAsync({
      username: username.trim(),
      old_password: oldPassword,
      password,
    });
  };

  return (
    <div className="max-w-[340px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="space-y-3.5"
      >
        <AppleInput
          label="账号"
          required
          value={username}
          onChange={(val) => setUsername(val)}
          placeholder="请输入新账号"
        />

        <AppleInput
          label="旧密码"
          type="password"
          required
          fontMono={false}
          value={oldPassword}
          onChange={(val) => setOldPassword(val)}
          placeholder="请输入当前密码"
          allowTogglePassword
        />

        <AppleInput
          label="新密码"
          type="password"
          required
          fontMono={false}
          value={password}
          onChange={(val) => setPassword(val)}
          placeholder="请输入新密码"
          allowTogglePassword
        />

        <AppleInput
          label="确认密码"
          type="password"
          required
          fontMono={false}
          value={confirmPassword}
          onChange={(val) => setConfirmPassword(val)}
          placeholder="请再次输入密码"
          allowTogglePassword
        />

        <div className="pt-2">
          <Popconfirm
            title="确认修改"
            description="修改账户信息后将自动退出登录，需要使用新凭据重新登录。"
            okText="确认"
            cancelText="取消"
            onConfirm={handleConfirmSubmit}
          >
            <button
              type="button"
              disabled={isPending}
              className="apple-btn-capsule px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </Popconfirm>
        </div>
      </form>
    </div>
  );
}
