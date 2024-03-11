-- ClientRemoteProperty
-- Stephen Leitnick
-- December 20, 2021

local Signal = require(script.Parent.Signal)
local ClientRemoteSignal = require(script.Parent.ClientRemoteSignal)

--[=[
	@within ClientRemoteProperty
	@prop Changed Signal<any>

	Fires when the property receives an updated value
	from the server.

	```lua
	clientRemoteProperty.changed:connect(function(value)
		print("New value", value)
	end)
	```
]=]

--[=[
	@class ClientRemoteProperty
	@client
	Created via `ClientComm:GetProperty()`.
]=]
local ClientRemoteProperty = {}
ClientRemoteProperty.__index = ClientRemoteProperty

function ClientRemoteProperty.new(re: RemoteEvent)
	local self = setmetatable({}, ClientRemoteProperty)
	self._rs = ClientRemoteSignal.new(re)
	self._ready = false
	self._value = nil
	self.changed = Signal.new()
	self._rs:Fire()

	self._changed = self._rs:connect(function(value)
		local changed = value ~= self._value
		self._value = value
		if not self._ready then
			self._ready = true
		end
		if changed then
			self.changed:fire(value)
		end
	end)

	return self
end

--[=[
	Gets the value of the property object.

	:::caution
	This value might not be ready right away. Use `onReady()` or `isReady()`
	before calling `get()`. If not ready, this value will return `nil`.
	:::
]=]
function ClientRemoteProperty:get(): any
	return self._value
end

--[=[
	Returns `true` if the property object is ready to be
	used. In other words, it has successfully gained
	connection to the server-side version and has synced
	in the initial value.

	```lua
	if clientRemoteProperty:IsReady() then
		local value = clientRemoteProperty:Get()
	end
	```
]=]
function ClientRemoteProperty:isReady(): boolean
	return self._ready
end

--[=[
	@param observer (any) -> nil
	@return Connection
	Observes the value of the property. The observer will
	be called right when the value is first ready, and
	every time the value changes. This is safe to call
	immediately (i.e. no need to use `IsReady` before using 
	this method).

	Observing is essentially listening to `changed`, but
	also sends the initial value right away (or at least
	once `OnReady` is completed).

	```lua
	local function ObserveValue(value)
		print(value)
	end

	clientRemoteProperty:observe(ObserveValue)
	```
]=]
function ClientRemoteProperty:observe(observer: (any) -> ())
	if self._ready then
		task.defer(observer, self._value)
	end
	return self.changed:connect(observer)
end

--[=[
	Destroys the ClientRemoteProperty object.
]=]
function ClientRemoteProperty:destroy()
	self._rs:destroy()
	if self._changed then
		self._changed:Disconnect()
	end
	self.changed:destroy()
end

return ClientRemoteProperty