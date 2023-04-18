#include <napi.h>
#include <iostream>
#include <Windows.h>

void MeowSpacebar(const Napi::CallbackInfo& info) {
	INPUT inputs[2] = {};
	ZeroMemory(inputs, sizeof(inputs));

	inputs[0].type = INPUT_KEYBOARD;
	inputs[0].ki.wVk = VK_SPACE;

	inputs[1].type = INPUT_KEYBOARD;
	inputs[1].ki.wVk = VK_SPACE;
	inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;

	UINT uSent = SendInput(ARRAYSIZE(inputs), inputs, sizeof(INPUT));
	if (uSent != ARRAYSIZE(inputs)) {
		std::cout << "SendInput failed: 0x%x\n", HRESULT_FROM_WIN32(GetLastError());
	}
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set(Napi::String::New(env, "MeowSpacebar"), Napi::Function::New(env, MeowSpacebar));
	return exports;
}

NODE_API_MODULE(meowspacebar, Init)